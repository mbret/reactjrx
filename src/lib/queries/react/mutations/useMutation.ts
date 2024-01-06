import { useLiveRef } from "../../../utils/useLiveRef"
import { useObserve } from "../../../binding/useObserve"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "../Provider"
import { serializeKey } from "../../client/keys/serializeKey"
import { nanoid } from "../../client/keys/nanoid"
import { useConstant } from "../../../utils/useConstant"
import { type QueryClient } from "../../client/createClient"
import { type DefaultError } from "../../client/types"
import { MutationObserver } from "../../client/mutations/observers/MutationObserver"
import {
  type UseMutationResult,
  type UseMutateFunction,
  type UseMutationOptions
} from "./types"

function noop() {}

export function useMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  queryClient?: QueryClient
): UseMutationResult<TData, TError, TVariables, TContext> {
  const defaultQueryClient = useQueryClient({ unsafe: !!queryClient })
  const finalQueryClient = queryClient ?? defaultQueryClient
  const optionsRef = useLiveRef(options)
  const defaultKey = useConstant(() => [nanoid()])
  const serializedKey = serializeKey(options.mutationKey ?? defaultKey.current)

  const [mutationObserver] = useState(
    () =>
      new MutationObserver<TData, TError, TVariables, TContext>(
        finalQueryClient,
        options
      )
  )

  useEffect(() => {
    // mutationObserver.setOptions(options)
  }, [mutationObserver, options])

  const observedMutation = useMemo(() => {
    void serializedKey

    return mutationObserver.observeBy({
      mutationKey: optionsRef.current.mutationKey ?? defaultKey.current
    })
  }, [serializedKey, defaultKey, mutationObserver, optionsRef])

  const result =
    useObserve(observedMutation.result$) ?? observedMutation.lastValue

  const mutate = useCallback<
    UseMutateFunction<TData, TError, TVariables, TContext>
  >(
    (variables, mutateOptions) => {
      mutationObserver.mutate(variables, mutateOptions).catch(noop)
    },
    [mutationObserver]
  )

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (optionsRef.current.cancelOnUnMount) {
        mutationObserver.reset()
      }
    }
  }, [mutationObserver, optionsRef])

  return { ...result, mutate, mutateAsync: result.mutate }
}
