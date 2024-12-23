import {
  DefaultError,
  QueryClient,
  QueryFunctionContext,
  QueryKey,
  useQuery,
  useQueryClient,
  UseQueryOptions
} from "@tanstack/react-query"
import { useRef } from "react"
import { defer, finalize, Observable, Subscription } from "rxjs"

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
      let lastData: TQueryFnData | undefined = undefined

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

      const source = defer(() =>
        typeof options.queryFn === "function"
          ? options.queryFn(context)
          : options.queryFn
      )

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

            _queryClient?.setQueryData<TQueryFnData>(context.queryKey, data)
          },
          error: (error) => {
            isResolved = true

            reject(error)
          },
          complete: () => {
            if (lastData === undefined)
              return reject(new Error("Stream completed without any data"))

            if (isResolved) return

            isResolved = true

            resolve(lastData)
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
