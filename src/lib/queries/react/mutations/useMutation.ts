import { useLiveRef } from "../../../utils/useLiveRef"
import { useObserve } from "../../../binding/useObserve"
import { useCallback, useEffect, useMemo } from "react"
import { type MutationOptions } from "../../client/mutations/types"
import { useQueryClient } from "../Provider"
import { type QueryKey } from "../../client/keys/types"
import { serializeKey } from "../keys/serializeKey"
import { nanoid } from "../keys/nanoid"
import { useConstant } from "../../../utils/useConstant"

export type AsyncQueryOptions<Result, Params> = Omit<
  MutationOptions<Result, Params>,
  "mutationKey"
> & {
  mutationKey?: QueryKey
  cancelOnUnMount?: boolean
}

export function useMutation<Args = void, R = undefined>(
  options: AsyncQueryOptions<R, Args>
) {
  const client = useQueryClient()
  const optionsRef = useLiveRef(options)
  const defaultKey = useConstant(() => [nanoid()])
  const key = serializeKey(options.mutationKey ?? defaultKey.current)
  const observedMutation = useMemo(
    () => client.mutationClient.observe<R>({ key }),
    [key]
  )

  const result =
    useObserve(observedMutation.result$) ?? observedMutation.lastValue

  const mutate = useCallback(
    (mutationArgs: Args) => {
      client.mutationClient.mutate({
        options: { ...optionsRef.current, mutationKey: key },
        args: mutationArgs
      })
    },
    [client, key]
  )

  const reset = useCallback(() => {
    client.mutationClient.reset({
      key: optionsRef.current.mutationKey ?? defaultKey.current
    })
  }, [client])

  useEffect(() => {
    return () => {
      if (optionsRef.current.cancelOnUnMount) {
        client.mutationClient.reset({
          key: optionsRef.current.mutationKey ?? defaultKey.current
        })
      }
    }
  }, [])

  return { mutate, reset, ...result }
}
