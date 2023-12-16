import { useLiveRef } from "../../../utils/useLiveRef"
import { useObserve } from "../../../binding/useObserve"
import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  type MutationKey,
  type MutationOptions
} from "../../client/mutations/types"
import { useQueryClient } from "../Provider"
import { serializeKey } from "../../client/keys/serializeKey"
import { nanoid } from "../../client/keys/nanoid"
import { useConstant } from "../../../utils/useConstant"
import { type QueryClient } from "../../client/createClient"

export type AsyncQueryOptions<Result, Params> = Omit<
  MutationOptions<Result, Error, Params>,
  "mutationKey"
> & {
  mutationKey?: MutationKey
  cancelOnUnMount?: boolean
}

export function useMutation<Args = void, R = undefined>(
  options: AsyncQueryOptions<R, Args>,
  queryClient?: QueryClient
) {
  const defaultQueryClient = useQueryClient({ unsafe: !!queryClient })
  const finalQueryClient = queryClient ?? defaultQueryClient
  const optionsRef = useLiveRef(options)
  const defaultKey = useConstant(() => [nanoid()])
  const serializedKey = serializeKey(options.mutationKey ?? defaultKey.current)
  const observedMutation = useMemo(
    () =>
      finalQueryClient.mutationObserver.observeBy<R>({
        mutationKey: options.mutationKey ?? defaultKey.current
      }),
    [serializedKey]
  )
  const mutationsToCancel = useRef<
    Array<
      ReturnType<typeof finalQueryClient.mutationClient.mutate<any, any, any>>
    >
  >([])

  const result =
    useObserve(observedMutation.result$) ?? observedMutation.lastValue

  const mutate = useCallback(
    (mutationArgs: Args) => {
      const mutation = finalQueryClient.mutationClient.mutate({
        options: {
          ...optionsRef.current,
          mutationKey: optionsRef.current.mutationKey ?? defaultKey.current
        },
        args: mutationArgs
      })

      mutationsToCancel.current.push(mutation)
    },
    [finalQueryClient, serializedKey]
  )

  const cancel = useCallback(() => {
    mutationsToCancel.current.forEach((mutation) => {
      mutation.cancel()
    })
  }, [])

  useEffect(() => {
    return () => {
      if (optionsRef.current.cancelOnUnMount) {
        cancel()
      }
    }
  }, [cancel])

  return { mutate, cancel, ...result }
}
