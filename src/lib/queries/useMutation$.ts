import {
  type DefaultError,
  type QueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from "@tanstack/react-query"
import { useEffect } from "react"
import { type Observable, take } from "rxjs"
import { useBehaviorSubject } from "../binding/useBehaviorSubject"

export type UseMutation$Options<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
> = Omit<
  UseMutationOptions<TData, TError, TVariables, TContext>,
  "mutationFn"
> & {
  mutationFn: ((variables: TVariables) => Observable<TData>) | Observable<TData>
}

export function useMutation$<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutation$Options<TData, TError, TVariables, TContext>,
  queryClient?: QueryClient,
) {
  const stateSubject = useBehaviorSubject<
    Pick<
      UseMutationResult<TData, TError, TVariables, TContext>,
      "status" | "isPending" | "isError" | "isSuccess" | "isIdle"
    >
  >({
    status: "idle",
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
  })

  const result = useMutation<TData, TError, TVariables, TContext>(
    {
      ...options,
      mutationFn: (variables: TVariables) => {
        let lastData: { value: TData } | undefined

        return new Promise<TData>((resolve, reject) => {
          const source =
            typeof options.mutationFn === "function"
              ? options.mutationFn(variables)
              : options.mutationFn

          source.pipe(take(1)).subscribe({
            next: (data) => {
              lastData = { value: data }
            },
            error: (error) => {
              reject(error)
            },
            complete: () => {
              if (lastData === undefined)
                return reject(new Error("Stream completed without any data"))

              resolve(lastData.value)
            },
          })
        })
      },
    },
    queryClient,
  )

  const { status, isPending, isError, isSuccess, isIdle } = result

  useEffect(() => {
    stateSubject.next({
      status,
      isPending,
      isError,
      isSuccess,
      isIdle,
    })
  }, [status, isPending, isError, isSuccess, isIdle, stateSubject])

  return { ...result, state$: stateSubject }
}
