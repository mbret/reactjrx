import {
  DefaultError,
  DefinedInitialDataOptions,
  DefinedUseQueryResult,
  QueryClient,
  QueryFunction,
  QueryFunctionContext,
  QueryKey,
  UndefinedInitialDataOptions,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult
} from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import {
  finalize,
  firstValueFrom,
  lastValueFrom,
  Observable,
  Subscription
} from "rxjs"
import { makeObservable } from "../queries/client/utils/makeObservable"

// export function useQuery$<
//   TQueryFnData = unknown,
//   TError = DefaultError,
//   TData = TQueryFnData,
//   TQueryKey extends QueryKey = QueryKey
// >(
//   options: DefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
//   queryClient?: QueryClient
// ): DefinedUseQueryResult<TData, TError>

// export function useQuery$<
//   TQueryFnData = unknown,
//   TError = DefaultError,
//   TData = TQueryFnData,
//   TQueryKey extends QueryKey = QueryKey
// >(
//   options: UndefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
//   queryClient?: QueryClient
// ): UseQueryResult<TData, TError>

// export function useQuery$<
//   TQueryFnData = unknown,
//   TError = DefaultError,
//   TData = TQueryFnData,
//   TQueryKey extends QueryKey = QueryKey
// >(
//   options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
//   queryClient?: QueryClient
// ): UseQueryResult<TData, TError>

export function useQuery$<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    "queryFn"
  > & {
    queryFn:
      | ((context: QueryFunctionContext<TQueryKey>) => Observable<TQueryFnData>)
      | Observable<TQueryFnData>
  },
  queryClient?: QueryClient
) {
  const sub = useRef<Subscription>()
  const _queryClient = useQueryClient(queryClient)

  const queryFnAsync = (context: QueryFunctionContext<TQueryKey>) => {
    let isResolved = false

    return new Promise<TQueryFnData>((resolve, reject) => {
      let lastData = undefined

      if (sub.current) {
        sub.current.unsubscribe()
        sub.current = undefined
      }

      /**
       * Auto unsubscribe when there is no more observers.
       */
      const unsub = _queryClient.getQueryCache().subscribe((d) => {
        if (d.type === "observerRemoved" && d.query.observers.length === 0) {
          unsub()

          _queryClient.cancelQueries({ queryKey: context.queryKey })
          sub.current?.unsubscribe()
        }
      })

      const source =
        typeof options.queryFn === "function"
          ? options.queryFn(context)
          : options.queryFn

      sub.current = source
        .pipe(
          finalize(() => {
            unsub()

            isResolved = true
          })
        )
        .subscribe({
          next: (data) => {
            lastData = data
            // console.log("next", data)
            _queryClient?.setQueryData(context.queryKey, data as any)
            // isResolved = true
          },
          error: (error) => {
            console.log("error", error)
            isResolved = true

            reject(error)
          },
          complete: () => {
            if (isResolved) return

            // console.log("complete")
            isResolved = true

            resolve(lastData as any)
          }
        })
    })
  }

  const result = useQuery<TQueryFnData, TError, TData, TQueryKey>(
    {
      ...options,
      queryFn: queryFnAsync
    },
    queryClient
  )

  return result
}
