import { useLiveRef } from "../utils/useLiveRef"
import {
  MonoTypeOperatorFunction,
  Observable,
  catchError,
  concatMap,
  defer,
  first,
  from,
  identity,
  map,
  mergeMap,
  of,
  switchMap,
  tap
} from "rxjs"
import { querx } from "./querx"
import { useBehaviorSubject } from "../binding/useBehaviorSubject"
import { useObserve } from "../binding/useObserve"
import { useSubject } from "../binding/useSubject"
import { useCallback, useEffect } from "react"

export type MutationOptions = {
  retry?: false | number | ((attempt: number, error: unknown) => boolean)
  onError?: (error: unknown) => void
  onSuccess?: () => void
  /**
   * When true, any running mutation will be cancelled (when possible) on unmount.
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
   * Only use for debugging
   */
  hooks?: MonoTypeOperatorFunction<any>
}

type Result<A, R> = {
  isLoading: boolean
  data: R | undefined
  error: unknown | undefined
  mutate: (args: A) => void
}

export function useMutation<A = void, R = undefined>(
  query: (args: A) => Promise<R> | Observable<R>,
  mapOperatorOrOptions?: ("switch" | "concat" | "merge") | MutationOptions,
  options?: MutationOptions
): Result<A, R>

/**
 * @important
 * Your mutation function is cancelled whenever you call a new mutate or
 * when the component is unmounted. Same behavior will happens with your
 * callback functions regarding unmounting. None of them will be called.
 *
 * If you provide an observable as a return it will be automatically cancelled
 * as well during unmount or if called again. If you provide anything else you
 * are in charge of controlling the flow.
 *
 * If you need to execute mutation independently of the component lifecycle or
 * execute functions in parallel you should not use this hook.
 *
 * @important
 * If you return an observable, the stream will be unsubscribed after receiving
 * the first value. This hook is not meant to be running long running effects.
 *
 * @todo keep mutation running on unmount
 * callback should return unmount$ variables
 * options.cancelOnUnmount should be false by default
 */
export function useMutation<A = void, R = undefined>(
  query: (args: A) => Promise<R> | Observable<R>,
  mapOperatorOrOptions:
    | ("switch" | "concat" | "merge")
    | MutationOptions = "merge",
  options: MutationOptions = {}
): Result<A, R> {
  const queryRef = useLiveRef(query)
  const triggerSubject = useSubject<A>()
  const optionsRef = useLiveRef(
    typeof mapOperatorOrOptions === "object" ? mapOperatorOrOptions : options
  )
  const data$ = useBehaviorSubject<{
    data: R | undefined
    isLoading: boolean
    error: unknown
  }>({
    data: undefined,
    error: undefined,
    isLoading: false
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

    const subscription = triggerSubject.current
      .pipe(
        tap(() => {
          data$.current.next({
            ...data$.current.getValue(),
            error: undefined,
            isLoading: true
          })
        }),
        switchOperator((args) =>
          from(defer(() => queryRef.current(args))).pipe(
            querx(optionsRef.current),
            first(),
            map((response) => [response] as const),
            catchError((error: unknown) => {
              optionsRef.current.onError && optionsRef.current.onError(error)

              return of([undefined, error] as const)
            }),
            tap(([response, error]) => {
              if (response) {
                optionsRef.current.onSuccess && optionsRef.current.onSuccess()
              }

              data$.current.next({
                ...data$.current.getValue(),
                isLoading: false,
                error,
                data: response
              })
            })
          )
        ),
        optionsRef.current.hooks ?? identity
      )
      .subscribe()

    return () => {
      if (optionsRef.current.cancelOnUnMount) {
        subscription.unsubscribe()
      }
    }
  }, [mapOperator])

  const result = useObserve(data$.current)

  const mutate = useCallback((arg: A) => {
    triggerSubject.current.next(arg)
  }, [])

  return { ...result, mutate }
}
