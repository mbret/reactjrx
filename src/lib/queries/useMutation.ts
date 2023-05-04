import { useLiveRef } from '../utils/useLiveRef'
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
  tap
} from 'rxjs'
import { querx } from './querx'
import { useBehaviorSubject } from '../binding/useBehaviorSubject'
import { useObserve } from '../binding/useObserve'
import { useSubject } from '../binding/useSubject'
import { useCallback, useEffect } from 'react'

export interface MutationOptions<R> {
  retry?: false | number | ((attempt: number, error: unknown) => boolean)
  /**
   * Called for every mutation on error.
   * `merge` mapping will run callback as they happen.
   * Use `concat` if you need to run callbacks in order of calling.
   */
  onError?: (error: unknown) => void
  /**
   * Called for every mutation on success.
   * `merge` mapping will run callback as they happen.
   * Use `concat` if you need to run callbacks in order of calling.
   */
  onSuccess?: (data: R) => void
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

interface Result<A, R> {
  status: 'idle' | 'loading' | 'error' | 'success'
  isLoading: boolean
  /**
   * If the latest mutation is in a success state, data contains its result.
   *
   * @important
   * The value does not automatically reset when a new mutation run. It will be updated
   * when a new mutation success or error.
   */
  data: R | undefined
  /**
   * If the latest mutation is in a error state, error contains its error.
   *
   * @important
   * The value does not automatically reset when a new mutation run. It will be updated
   * when a new mutation success or error.
   */
  error: unknown | undefined
  mutate: (args: A) => void
}

/**
 * The default value `merge` is suitable for most use case.
 * You should not have to worry too much about it and only consider changing
 * it when specific need arise.
 *
 * `merge`:
 * Run each mutation as they are triggered without any cancellation or queue system.
 * The result is always from the latest mutation triggered, not necessarily
 * the latest one running.
 *
 * `concat`:
 * Unlike merge, it will trigger each mutation sequentially following
 * a queue system. The result is not necessarily the last triggered mutation
 * but the current running mutation.
 *
 * `switch`:
 * Only run the latest mutation triggered and cancel any previously running one.
 * Result correspond to the current running mutation.
 */
type MapOperator = 'switch' | 'concat' | 'merge'

export function useMutation<A = void, R = undefined> (
  query: (args: A) => Promise<R> | Observable<R>,
  mapOperatorOrOptions?: MapOperator,
  options?: MutationOptions<R>
): Result<A, R>

export function useMutation<A = void, R = undefined> (
  query: (args: A) => Promise<R> | Observable<R>,
  mapOperatorOrOptions?: MutationOptions<R>
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
export function useMutation<A = void, R = undefined> (
  query: (args: A) => Promise<R> | Observable<R>,
  mapOperatorOrOptions?: MapOperator | MutationOptions<R>,
  options: MutationOptions<R> = {}
): Result<A, R> {
  const queryRef = useLiveRef(query)
  const triggerSubject = useSubject<A>()
  const optionsRef = useLiveRef(
    typeof mapOperatorOrOptions === 'object' ? mapOperatorOrOptions : options
  )
  const data$ = useBehaviorSubject<{
    data: R | undefined
    status: 'idle' | 'loading' | 'error' | 'success'
    error: unknown
  }>({
    data: undefined,
    error: undefined,
    status: 'idle'
  })
  const mapOperator =
    typeof mapOperatorOrOptions === 'string' ? mapOperatorOrOptions : 'merge'

  useEffect(() => {
    const switchOperator =
      mapOperator === 'concat'
        ? concatMap
        : mapOperator === 'switch'
          ? switchMap
          : mergeMap

    const subscription = triggerSubject.current
      .pipe(
        switchOperator((args) => {
          const newMutationCalled$ = triggerSubject.current.pipe(
            take(1),
            map(() => mapOperator === 'concat'),
            startWith(true)
          )

          data$.current.next({
            ...data$.current.getValue(),
            status: 'loading'
          })

          return combineLatest([
            from(defer(async () => await queryRef.current(args))).pipe(
              querx(optionsRef.current),
              first(),
              map((response) => [response] as const),
              catchError((error: unknown) => {
                optionsRef.current.onError != null &&
                  optionsRef.current.onError(error)

                return of([undefined, error] as const)
              })
            ),
            newMutationCalled$
          ]).pipe(
            tap(([[response, error], isLastMutation]) => {
              if (response) {
                optionsRef.current.onSuccess != null &&
                  optionsRef.current.onSuccess(response)
              }

              if (isLastMutation) {
                data$.current.next({
                  ...data$.current.getValue(),
                  ...(error
                    ? {
                        status: 'error',
                        error,
                        data: undefined
                      }
                    : {
                        status: 'success',
                        error: undefined,
                        data: response
                      })
                })
              }
            })
          )
        }),
        optionsRef.current.hooks ?? identity
      )
      .subscribe()

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

  return { ...result, isLoading: result.status === 'loading', mutate }
}
