import {
  DefaultError,
  QueryClient,
  useMutation,
  UseMutationOptions,
} from "@tanstack/react-query"
import { Observable, take } from "rxjs"

export function useMutation$<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
>(
  options: Omit<
    UseMutationOptions<TData, TError, TVariables, TContext>,
    "mutationFn"
  > & {
    mutationFn:
      | ((variables: TVariables) => Observable<TData>)
      | Observable<TData>
  },
  queryClient?: QueryClient
) {
  const mutationFnAsync = (variables: TVariables) => {
    let lastData: TData | undefined

    return new Promise<TData>((resolve, reject) => {
      const source =
        typeof options.mutationFn === "function"
          ? options.mutationFn(variables)
          : options.mutationFn

      source.pipe(take(1)).subscribe({
        next: (data) => {
          lastData = data
        },
        error: (error) => {
          reject(error)
        },
        complete: () => {
          if (lastData === undefined)
            return reject(new Error("Stream completed without any data"))

          resolve(lastData)
        }
      })
    })
  }

  const result = useMutation<TData, TError, TVariables, TContext>(
    {
      ...options,
      mutationFn: mutationFnAsync
    },
    queryClient
  )

  return result
}
