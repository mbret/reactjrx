import { useLiveRef } from "../../../utils/useLiveRef"
import {
  type MonoTypeOperatorFunction,
  identity,
  map,
  finalize,
  NEVER
} from "rxjs"
import { useBehaviorSubject } from "../../../binding/useBehaviorSubject"
import { useObserve } from "../../../binding/useObserve"
import { useCallback, useEffect, useState } from "react"
import { type MutationOptions } from "../../client/mutations/types"
import { useQueryClient } from "../Provider"
import { type QueryKey } from "../../client/keys/types"

export type AsyncQueryOptions<Result, Params> = Omit<
  MutationOptions<Result, Params>,
  "mutationKey"
> & {
  mutationKey?: QueryKey
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
  __triggerHook?: MonoTypeOperatorFunction<unknown>
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
  const [bufferTriggers, setBufferTriggers] = useState<Args[]>([])

  const createMutation = useCallback(
    () =>
      client.createMutation(
        optionsSubject.current.pipe(
          map((options) => ({
            mutationKey: ["none"],
            ...options
          }))
        )
      ),
    []
  )

  const [mutation, setMutation] = useState<
    undefined | ReturnType<typeof createMutation>
  >(undefined)

  const { mutation$, trigger$, reset$ } = mutation ?? {}

  useEffect(() => {
    const mutation = createMutation()

    setMutation(mutation)

    return () => {
      mutation.destroy()
    }
  }, [])

  const result = useObserve(
    () =>
      !mutation$
        ? NEVER
        : mutation$.pipe(
            (optionsRef.current.__triggerHook as typeof identity) ?? identity,
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
    [mutation$]
  )

  const mutate = useCallback(
    (mutationArgs: Args) => {
      if (!trigger$) {
        setBufferTriggers((value) => [...value, mutationArgs])
      }
      trigger$?.next(mutationArgs)
    },
    [trigger$]
  )

  useEffect(() => {
    if (mutation && !mutation.getClosed()) {
      bufferTriggers.forEach((args) => {
        mutation.trigger$.next(args)
      })
    }
  }, [bufferTriggers, mutation])

  const reset = useCallback(() => {
    reset$?.next()
  }, [reset$])

  return { mutate, reset, ...result }
}
