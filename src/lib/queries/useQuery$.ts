import {
  CancelledError,
  type DefaultError,
  hashKey,
  type QueryClient,
  type QueryFunctionContext,
  type QueryKey,
  skipToken,
  type UseQueryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { defer, delay, type Observable, take } from "rxjs"
import { useQueryClient$ } from "./QueryClientProvider$"

export function useQuery$<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  {
    queryFn,
    ...options
  }: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    "queryFn"
  > & {
    queryFn:
      | ((context: QueryFunctionContext<TQueryKey>) => Observable<TQueryFnData>)
      | typeof skipToken
      | Observable<TQueryFnData>
  },
  queryClient?: QueryClient,
) {
  const _queryClient = useQueryClient(queryClient)
  const queryClient$ = useQueryClient$()

  const queryFnAsync = (context: QueryFunctionContext<TQueryKey>) => {
    if (queryFn === skipToken) {
      throw new Error("useQuery$: queryFnAsync called with skipToken")
    }

    return new Promise<TQueryFnData>((resolve, reject) => {
      const getSource = () =>
        defer(() =>
          typeof queryFn === "function" ? queryFn(context) : queryFn,
        )

      const queryHash = hashKey(context.queryKey)

      const queryAlreadyInCache = queryClient$.getQuery(queryHash)

      const queryCacheEntry =
        queryAlreadyInCache ??
        queryClient$.setQuery(context.queryKey, getSource(), context.signal)

      const refetchIfNeeded = () => {
        if (queryCacheEntry?.isCompleted === false) {
          setTimeout(() => {
            _queryClient?.refetchQueries({
              queryKey: context.queryKey,
              exact: true,
            })
          })
        }
      }

      // if the observable returns results synchronously
      if (!queryAlreadyInCache && queryCacheEntry.lastData !== undefined) {
        resolve(queryCacheEntry.lastData.value as TQueryFnData)

        refetchIfNeeded()

        return
      }

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
                // query naturally cancelled by external factors.
                return reject(new CancelledError())
              }

              console.warn(
                `cancelled due to stream completing without data for query ${queryHash}`,
              )

              return reject(new CancelledError())
            }

            resolve(queryCacheEntry.lastData.value as TQueryFnData)

            refetchIfNeeded()
          },
        })
    })
  }

  const result = useQuery<TQueryFnData, TError, TData, TQueryKey>(
    {
      ...options,
      queryFn: queryFn === skipToken ? skipToken : queryFnAsync,
    },
    queryClient,
  )

  return result
}
