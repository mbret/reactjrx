import { useLiveRef } from "../utils/useLiveRef"
import {
  type MonoTypeOperatorFunction,
  type Observable,
  catchError,
  combineLatest,
  concatMap,
  defer,
  first,
  from,
  identity,
  map,
  mergeMap,
  of,
  startWith,
  switchMap,
  take,
  takeUntil,
  finalize,
  merge,
  distinctUntilChanged,
  filter
} from "rxjs"
import { querx } from "./querx"
import { useBehaviorSubject } from "../binding/useBehaviorSubject"
import { useObserve } from "../binding/useObserve"
import { useSubject } from "../binding/useSubject"
import { useCallback, useEffect } from "react"
import { shallowEqual } from "../utils/shallowEqual"

interface QueryState<R> {
  data: R | undefined
  status: "idle" | "loading" | "error" | "success"
  error: unknown
}

export interface AsyncQueryOptions<Result, Params> {
  retry?: false | number | ((attempt: number, error: unknown) => boolean)
  /**
   * Called for every async query on error.
   * `merge` mapping will run callback as they happen.
   * Use `concat` if you need to run callbacks in order of calling.
   */
  onError?: (error: unknown, params: Params) => void
  /**
   * Called for every async query on success.
   * `merge` mapping will run callback as they happen.
   * Use `concat` if you need to run callbacks in order of calling.
   */
  onSuccess?: (data: Result, params: Params) => void
  /**
   * When true, any running async query will be cancelled (when possible) on unmount.
   * You need to handle it yourself for promises if needed.
   * Callbacks will not be called as a result.
   *
   * This is unlikely to be needed but in some situation you may want to cancel
   * any ongoing process if the user navigate away for example.
   *
   * @default false
   */
  cancelOnUnMount?: boolean
  /**
   * Only use for debugging.
   * It is not the main subscription hook, only the one following the trigger.
   */
  triggerHook?: MonoTypeOperatorFunction<
    Partial<QueryState<Result>> | undefined
  >
}

interface Result<A, R> {
  status: "idle" | "loading" | "error" | "success"
  isLoading: boolean
  /**
   * If the latest async query is in a success state, data contains its result.
   *
   * @important
   * The value does not automatically reset when a new async query run. It will be updated
   * when a new async query success or error.
   */
  data: R | undefined
  /**
   * If the latest async query is in a error state, error contains its error.
   *
   * @important
   * The value does not automatically reset when a new async query run. It will be updated
   * when a new async query success or error.
   */
  error: unknown | undefined
  mutate: (args: A) => void
  reset: () => void
}

/**
 * The default value `merge` is suitable for most use case.
 * You should not have to worry too much about it and only consider changing
 * it when specific need arise.
 *
 * `merge`:
 * Run each async query as they are triggered without any cancellation or queue system.
 * The result is always from the latest async query triggered, not necessarily
 * the latest one running.
 *
 * `concat`:
 * Unlike merge, it will trigger each async query sequentially following
 * a queue system. The result is not necessarily the last triggered async query
 * but the current running async query.
 *
 * `switch`:
 * Only run the latest async query triggered and cancel any previously running one.
 * Result correspond to the current running async query.
 */
type MapOperator = "switch" | "concat" | "merge"

export function useAsyncQuery<A = void, R = undefined>(
  query: (args: A) => Promise<R> | Observable<R>,
  mapOperatorOrOptions?: MapOperator,
  options?: AsyncQueryOptions<R, A>
): Result<A, R>

export function useAsyncQuery<A = void, R = undefined>(
  query: (args: A) => Promise<R> | Observable<R>,
  mapOperatorOrOptions?: AsyncQueryOptions<R, A>
): Result<A, R>

/**
 * @important
 * Your async query function is cancelled whenever you call a new mutate or
 * when the component is unmounted. Same behavior will happens with your
 * callback functions regarding unmounting. None of them will be called.
 *
 * If you provide an observable as a return it will be automatically cancelled
 * as well during unmount or if called again. If you provide anything else you
 * are in charge of controlling the flow.
 *
 * If you need to execute async query independently of the component lifecycle or
 * execute functions in parallel you should not use this hook.
 *
 * @important
 * If you return an observable, the stream will be unsubscribed after receiving
 * the first value. This hook is not meant to be running long running effects.
 *
 * @todo keep async query running on unmount
 * callback should return unmount$ variables
 * options.cancelOnUnmount should be false by default
 */
export function useAsyncQuery<A = void, R = undefined>(
  query: (args: A) => Promise<R> | Observable<R>,
  mapOperatorOrOptions?: MapOperator | AsyncQueryOptions<R, A>,
  options: AsyncQueryOptions<R, A> = {}
): Result<A, R> {
  const queryRef = useLiveRef(query)
  const triggerSubject = useSubject<A>()
  const resetSubject = useSubject<void>({
    /**
     * @important
     * Because async query can still run after unmount, the user might
     * want to use reset for whatever reason. We will only manually complete
     * this subject whenever the main query hook finalize.
     */
    completeOnUnmount: false
  })
  const optionsRef = useLiveRef(
    typeof mapOperatorOrOptions === "object" ? mapOperatorOrOptions : options
  )
  const data$ = useBehaviorSubject<{
    data: R | undefined
    status: "idle" | "loading" | "error" | "success"
    error: unknown
  }>({
    data: undefined,
    error: undefined,
    status: "idle"
  })
  const mapOperator =
    typeof mapOperatorOrOptions === "string" ? mapOperatorOrOptions : "merge"

  useEffect(() => {
    const switchOperator =
      mapOperator === "concat"
        ? concatMap
        : mapOperator === "switch"
        ? switchMap
        : mergeMap

    const subscription = merge(
      resetSubject.current.pipe(
        map(
          () =>
            ({
              status: "idle",
              data: undefined,
              error: undefined
            } satisfies QueryState<R>)
        )
      ),
      triggerSubject.current.pipe(
        switchOperator((args) => {
          const isLastMutationCalled = triggerSubject.current.pipe(
            take(1),
            map(() => mapOperator === "concat"),
            startWith(true)
          )

          return merge(
            of<Partial<QueryState<R>>>({
              status: "loading"
            }),
            combineLatest([
              defer(() => from(queryRef.current(args))).pipe(
                querx(optionsRef.current),
                first(),
                map((data) => ({ data, isError: false })),
                catchError((error: unknown) => {
                  console.error(error)

                  if (optionsRef.current.onError != null) {
                    optionsRef.current.onError(error, args)
                  }

                  return of({ data: error, isError: true })
                })
              ),
              isLastMutationCalled
            ]).pipe(
              map(([{ data, isError }, isLastMutationCalled]) => {
                console.log("success", { data, isLastMutationCalled })
                if (!isError) {
                  if (optionsRef.current.onSuccess != null)
                    optionsRef.current.onSuccess(data as R, args)
                }

                if (isLastMutationCalled) {
                  return isError
                    ? {
                        status: "error" as const,
                        error: data,
                        data: undefined
                      }
                    : {
                        status: "success" as const,
                        error: undefined,
                        data: data as R
                      }
                }

                return undefined
              }),
              takeUntil(resetSubject.current)
            )
          )
        }),
        optionsRef.current.triggerHook ?? identity,
        finalize(() => {
          resetSubject.current.complete()
        })
      )
    )
      .pipe(
        filter((state) => !!state && !!Object.keys(state).length),
        /**
         * @important
         * state update optimization
         */
        distinctUntilChanged(shallowEqual)
      )
      .subscribe((state) => {
        data$.current.next({
          ...data$.current.getValue(),
          ...state
        })
      })

    return () => {
      if (optionsRef.current.cancelOnUnMount) {
        subscription.unsubscribe()
      }
    }
  }, [mapOperator])

  const result = useObserve(
    () => data$.current,
    {
      defaultValue: data$.current.getValue()
    },
    []
  )

  const mutate = useCallback((arg: A) => {
    triggerSubject.current.next(arg)
  }, [])

  const reset = useCallback(() => {
    resetSubject.current.next()
  }, [])

  return { ...result, isLoading: result.status === "loading", mutate, reset }
}
