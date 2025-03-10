import {
  type DefaultError,
  type QueryClient,
  type QueryFunctionContext,
  type QueryKey,
  type UseQueryOptions,
  hashKey,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { type Observable, defer, delay, take } from "rxjs"
import { useQueryClient$ } from "./QueryClientProvider$"

export function useQuery$<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    "queryFn"
  > & {
    queryFn:
      | ((context: QueryFunctionContext<TQueryKey>) => Observable<TQueryFnData>)
      | Observable<TQueryFnData>
  },
  queryClient?: QueryClient,
) {
  const _queryClient = useQueryClient(queryClient)
  const queryClient$ = useQueryClient$()

  const queryFnAsync = (context: QueryFunctionContext<TQueryKey>) => {
    return new Promise<TQueryFnData>((resolve, reject) => {
      const getSource = () =>
        defer(() =>
          typeof options.queryFn === "function"
            ? options.queryFn(context)
            : options.queryFn,
        )

      const queryHash = hashKey(context.queryKey)

      const queryCacheEntry =
        queryClient$.getQuery(queryHash) ??
        queryClient$.setQuery(context.queryKey, getSource(), context.signal)

      const query$ = queryCacheEntry.query$

      query$
        .pipe(
          take(1),
          /**
           * If several values are emitted during this delay, we will only
           * keep the last value. This is unfortunate but it's the best we can do
           * for now.
           */
          delay(1),
        )
        .subscribe({
          error: (error) => {
            return reject(error)
          },
          complete: () => {
            if (queryCacheEntry?.lastData === undefined) {
              if (queryCacheEntry.signal.aborted) {
                return resolve(undefined as TQueryFnData)
              }

              console.log(
                `cancelled due to stream completing without data for query ${queryHash}`,
                queryCacheEntry?.lastData,
              )

              _queryClient.cancelQueries({
                queryKey: context.queryKey,
                exact: true,
              })

              return resolve(undefined as TQueryFnData)
            }

            resolve(queryCacheEntry.lastData.value as TQueryFnData)

            if (queryCacheEntry?.isCompleted === false) {
              setTimeout(() => {
                _queryClient?.refetchQueries({
                  queryKey: context.queryKey,
                  exact: true,
                })
              })
            }
          },
        })
    })
  }

  const result = useQuery<TQueryFnData, TError, TData, TQueryKey>(
    {
      ...options,
      queryFn: queryFnAsync,
    },
    queryClient,
  )

  return result
}
