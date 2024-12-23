import { DefaultError, QueryClient } from "@tanstack/react-query"
import { defaultIfEmpty, takeUntil } from "rxjs"
import { useCallback } from "react"
import { useObservableCallback } from "../binding/useObservableCallback"
import { useMutation$, UseMutation$Options } from "./useMutation$"

export function useSwitchMutation$<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutation$Options<TData | null, TError, TVariables, TContext>,
  queryClient?: QueryClient
) {
  const [cancel$, cancel] = useObservableCallback()
  type TDataOrNull = TData | null

  const {
    mutate,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mutateAsync: _removed,
    ...rest
  } = useMutation$<TDataOrNull, TError, TVariables, TContext>(
    {
      ...options,
      mutationFn: (variables) => {
        const source =
          typeof options.mutationFn === "function"
            ? options.mutationFn(variables)
            : options.mutationFn

        return source.pipe(takeUntil(cancel$), defaultIfEmpty(null))
      }
    },
    queryClient
  )

  const mutateSwitch = useCallback(
    (variables: TVariables) => {
      cancel()
      mutate(variables)
    },
    [mutate, cancel]
  )

  return { ...rest, mutate: mutateSwitch }
}
