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
import { type Mutation } from "../../client/mutations/Mutation"
import { type DefaultError } from "../../client/types"

export type AsyncQueryOptions<Result, Params> = Omit<
  MutationOptions<Result, Error, Params>,
  "mutationKey"
> & {
  mutationKey?: MutationKey
  cancelOnUnMount?: boolean
}

function noop() {}

export function useMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
>(options: AsyncQueryOptions<TData, TVariables>, queryClient?: QueryClient) {
  const defaultQueryClient = useQueryClient({ unsafe: !!queryClient })
  const finalQueryClient = queryClient ?? defaultQueryClient
  const optionsRef = useLiveRef(options)
  const defaultKey = useConstant(() => [nanoid()])
  const serializedKey = serializeKey(options.mutationKey ?? defaultKey.current)
  const mutationsToCancel = useRef<Array<Mutation<any>>>([])
  const observedMutation = useMemo(() => {
    void serializedKey

    return finalQueryClient.mutationObserver.observeBy<TData, TError, TVariables, TContext>({
      mutationKey: optionsRef.current.mutationKey ?? defaultKey.current
    })
  }, [serializedKey, defaultKey, finalQueryClient, optionsRef])

  const result =
    useObserve(observedMutation.result$) ?? observedMutation.lastValue

  const mutate = useCallback(
    (mutationArgs: TVariables) => {
      void serializedKey

      finalQueryClient.mutationRunners
        .mutate({
          options: {
            ...optionsRef.current,
            mutationKey: optionsRef.current.mutationKey ?? defaultKey.current
          },
          args: mutationArgs
        })
        .catch(noop)

      const mutation = finalQueryClient.getMutationCache().findLatest({
        mutationKey: optionsRef.current.mutationKey ?? defaultKey.current
      })

      if (mutation) {
        mutationsToCancel.current.push(mutation)
      }
    },
    [finalQueryClient, serializedKey, defaultKey, optionsRef]
  )

  const cancel = useCallback(() => {
    mutationsToCancel.current.forEach((mutation) => {
      mutation.cancel()
    })
  }, [])

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (optionsRef.current.cancelOnUnMount) {
        cancel()
      }
    }
  }, [cancel, optionsRef])

  return { mutate, cancel, ...result }
}
