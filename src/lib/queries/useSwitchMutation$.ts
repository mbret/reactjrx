import type { DefaultError, QueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { defaultIfEmpty, takeUntil } from "rxjs"
import { useObservableCallback } from "../binding/useObservableCallback"
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
  const [cancel$, cancel] = useObservableCallback()
  type TDataOrNull = TData | null

  const { mutate, mutateAsync, ...rest } = useMutation$<
    TDataOrNull,
    TError,
    TVariables,
    TContext
  >(
    {
      ...options,
      mutationFn: (variables) => {
        const source =
          typeof options.mutationFn === "function"
            ? options.mutationFn(variables)
            : options.mutationFn

        return source.pipe(takeUntil(cancel$), defaultIfEmpty(null))
      },
    },
    queryClient,
  )

  const mutateSwitch = useCallback(
    (variables: TVariables) => {
      cancel()

      return mutate(variables)
    },
    [mutate, cancel],
  )

  const mutateAsyncSwitch = useCallback(
    (variables: TVariables) => {
      cancel()

      return mutateAsync(variables)
    },
    [mutateAsync, cancel],
  )

  return { ...rest, mutate: mutateSwitch, mutateAsync: mutateAsyncSwitch }
}
