import { useLiveRef } from "../../../utils/useLiveRef"
import { useObserve } from "../../../binding/useObserve"
import { useCallback, useEffect, useMemo } from "react"
import {
  type MutationKey,
  type MutationOptions
} from "../../client/mutations/types"
import { useQueryClient } from "../Provider"
import { serializeKey } from "../../client/keys/serializeKey"
import { nanoid } from "../keys/nanoid"
import { useConstant } from "../../../utils/useConstant"
import { type QueryClient } from "../../client/createClient"

export type AsyncQueryOptions<Result, Params> = Omit<
  MutationOptions<Result, Params>,
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
  const finalQueryClient = queryClient?.client ?? defaultQueryClient
  const optionsRef = useLiveRef(options)
  const defaultKey = useConstant(() => [nanoid()])
  const key = serializeKey(options.mutationKey ?? defaultKey.current)
  const observedMutation = useMemo(
    () => finalQueryClient.mutationClient.observe<R>({ key }),
    [key]
  )

  const result =
    useObserve(observedMutation.result$) ?? observedMutation.lastValue

  const mutate = useCallback(
    (mutationArgs: Args) => {
      finalQueryClient.mutationClient.mutate({
        options: {
          ...optionsRef.current,
          mutationKey: optionsRef.current.mutationKey ?? defaultKey.current
        },
        args: mutationArgs
      })
    },
    [finalQueryClient, key]
  )

  const cancel = useCallback(() => {
    finalQueryClient.mutationClient.cancel({
      key: optionsRef.current.mutationKey ?? defaultKey.current
    })
  }, [finalQueryClient])

  useEffect(() => {
    return () => {
      if (optionsRef.current.cancelOnUnMount) {
        finalQueryClient.mutationClient.cancel({
          key: optionsRef.current.mutationKey ?? defaultKey.current
        })
      }
    }
  }, [])

  return { mutate, cancel, ...result }
}
