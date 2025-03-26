import type { DefaultError, QueryClient } from "@tanstack/react-query"
import { useCallback, useRef } from "react"
import { defaultIfEmpty, fromEvent, of, takeUntil } from "rxjs"
import { type UseMutation$Options, useMutation$ } from "./useMutation$"

export function useSwitchMutation$<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutation$Options<TData | null, TError, TVariables, TContext>,
  queryClient?: QueryClient,
) {
  const previousMutationCancelRef = useRef(new AbortController())
  type TDataOrNull = TData | null

  const { mutate, mutateAsync, ...rest } = useMutation$<
    TDataOrNull,
    TError,
    { variables: TVariables; abort: AbortSignal },
    TContext
  >(
    {
      ...options,
      mutationFn: ({ variables, abort }) => {
        if (abort.aborted) {
          return of(null)
        }

        const source =
          typeof options.mutationFn === "function"
            ? options.mutationFn(variables)
            : options.mutationFn

        return source.pipe(
          takeUntil(fromEvent(abort, "abort")),
          defaultIfEmpty(null),
        )
      },
      onMutate: ({ variables }) => {
        return options.onMutate?.(variables)
      },
      onSuccess: (data, { variables }, context) => {
        return options.onSuccess?.(data, variables, context)
      },
      onError: (error, { variables }, ...rest) => {
        return options.onError?.(error, variables, ...rest)
      },
      onSettled: (data, error, { variables }, context) => {
        return options.onSettled?.(data, error, variables, context)
      },
    },
    queryClient,
  )

  const mutateSwitch = useCallback(
    (variables: TVariables) => {
      previousMutationCancelRef.current.abort()
      previousMutationCancelRef.current = new AbortController()

      return mutate({
        variables,
        abort: previousMutationCancelRef.current.signal,
      })
    },
    [mutate],
  )

  const mutateAsyncSwitch = useCallback(
    (variables: TVariables) => {
      previousMutationCancelRef.current.abort()
      previousMutationCancelRef.current = new AbortController()

      return mutateAsync({
        variables,
        abort: previousMutationCancelRef.current.signal,
      })
    },
    [mutateAsync],
  )

  return { ...rest, mutate: mutateSwitch, mutateAsync: mutateAsyncSwitch }
}
