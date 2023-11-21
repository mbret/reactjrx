import { useLiveRef } from "../../../utils/useLiveRef"
import {
  type MonoTypeOperatorFunction,
  identity,
  map,
  finalize,
} from "rxjs"
import { useBehaviorSubject } from "../../../binding/useBehaviorSubject"
import { useObserve } from "../../../binding/useObserve"
import { useCallback, useEffect } from "react"
import {
  type MutationOptions,
} from "../../client/mutations/types"
import { useQueryClient } from "../Provider"
import { useConstant } from "../../../utils/useConstant"
import { type QueryKey } from "../../client/keys/types"

interface QueryState<R> {
  data: R | undefined
  status: "idle" | "loading" | "error" | "success"
  error: unknown
}

export type AsyncQueryOptions<Result, Params> = Omit<
  MutationOptions<Result, Params>,
  "mutationKey"
> & {
  mutationKey?: QueryKey
  // retry?: false | number | ((attempt: number, error: unknown) => boolean)
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
export function useMutation<Args = void, R = undefined>(
  options: AsyncQueryOptions<R, Args>
) {
  const client = useQueryClient()
  const optionsRef = useLiveRef(options)
  const optionsSubject = useBehaviorSubject(options)

  // useEffect(() => {
  //   const switchOperator =
  //     mapOperator === "concat"
  //       ? concatMap
  //       : mapOperator === "switch"
  //         ? switchMap
  //         : mergeMap

  //   const subscription = merge(
  //     resetSubject.current.pipe(
  //       map(
  //         () =>
  //           ({
  //             status: "idle",
  //             data: undefined,
  //             error: undefined
  //           }) satisfies QueryState<R>
  //       )
  //     ),
  //     triggerSubject.current.pipe(
  //       switchOperator((args) => {
  //         const isLastMutationCalled = triggerSubject.current.pipe(
  //           take(1),
  //           map(() => mapOperator === "concat"),
  //           startWith(true)
  //         )

  //         return merge(
  //           of<Partial<QueryState<R>>>({
  //             status: "loading"
  //           }),
  //           combineLatest([
  //             defer(() => from(queryRef.current(args))).pipe(
  //               retryOnError(optionsRef.current),
  //               first(),
  //               map((data) => ({ data, isError: false })),
  //               catchError((error: unknown) => {
  //                 console.error(error)

  //                 if (optionsRef.current.onError != null) {
  //                   optionsRef.current.onError(error, args)
  //                 }

  //                 return of({ data: error, isError: true })
  //               })
  //             ),
  //             isLastMutationCalled
  //           ]).pipe(
  //             map(([{ data, isError }, isLastMutationCalled]) => {
  //               // console.log("success", { data, isLastMutationCalled })
  //               if (!isError) {
  //                 if (optionsRef.current.onSuccess != null)
  //                   optionsRef.current.onSuccess(data as R, args)
  //               }

  //               if (isLastMutationCalled) {
  //                 return isError
  //                   ? {
  //                       status: "error" as const,
  //                       error: data,
  //                       data: undefined
  //                     }
  //                   : {
  //                       status: "success" as const,
  //                       error: undefined,
  //                       data: data as R
  //                     }
  //               }

  //               return undefined
  //             }),
  //             takeUntil(resetSubject.current)
  //           )
  //         )
  //       }),
  //       optionsRef.current.triggerHook ?? identity,
  //       finalize(() => {
  //         resetSubject.current.complete()
  //       })
  //     )
  //   )
  //     .pipe(
  //       filter((state) => !!state && !!Object.keys(state).length),
  //       /**
  //        * @important
  //        * state update optimization
  //        */
  //       distinctUntilChanged(shallowEqual)
  //     )
  //     .subscribe((state) => {
  //       data$.current.next({
  //         ...data$.current.getValue(),
  //         ...state
  //       })
  //     })

  //   return () => {
  //     if (optionsRef.current.cancelOnUnMount) {
  //       subscription.unsubscribe()
  //     }
  //   }
  // }, [mapOperator])

  useEffect(() => {
    console.log("mount")

    return () => {
      console.log("unmount")
    }
  }, [])

  const {
    current: { mutation$, trigger$, reset$, destroy }
  } = useConstant(() =>
    client.createMutation(
      optionsSubject.current.pipe(
        map((options) => ({
          mutationKey: ["none"],
          ...options
        }))
      )
    )
  )

  useEffect(
    () => () => {
      console.log("destroy")
      destroy()
    },
    [destroy]
  )

  const result = useObserve(
    () =>
      mutation$.pipe(
        optionsSubject.current.getValue().triggerHook ?? identity,
        finalize(() => {
          console.log("finalize")
        })
      ),
    {
      defaultValue: {
        data: undefined,
        error: undefined,
        status: "idle"
      },
      unsubscribeOnUnmount: optionsRef.current.cancelOnUnMount ?? false
    },
    []
  )

  const mutate = useCallback(
    (mutationArgs: Args) => {
      trigger$.next(mutationArgs)
    },
    [trigger$]
  )

  const reset = useCallback(() => {
    reset$.next()
  }, [reset$])

  return { mutate, reset, ...result }
}
