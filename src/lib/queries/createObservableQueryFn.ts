import {
  CancelledError,
  hashKey,
  type QueryClient,
  type QueryFunctionContext,
  type QueryKey,
  skipToken,
} from "@tanstack/react-query"
import { defer, delay, type Observable, take } from "rxjs"
import type { QueryClient$ } from "./QueryClientProvider$"

export type ObservableQueryFn<
  TQueryFnData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> =
  | ((context: QueryFunctionContext<TQueryKey>) => Observable<TQueryFnData>)
  | typeof skipToken
  | Observable<TQueryFnData>

/**
 * Bridges an Observable-based `queryFn` to the Promise-based `queryFn`
 * expected by TanStack Query. Shared by `useQuery$` and `useQueries$` so
 * both rely on the exact same subscription, caching and cancellation logic.
 */
export function createObservableQueryFn<
  TQueryFnData = unknown,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryClient$: QueryClient$,
  queryClient: QueryClient | undefined,
  queryFn: ObservableQueryFn<TQueryFnData, TQueryKey> | undefined,
) {
  if (queryFn === skipToken || queryFn === undefined) {
    return queryFn
  }

  return (context: QueryFunctionContext<TQueryKey>) => {
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
            /**
             * Re-check at firing time: the entry may have been torn down
             * (deleteQuery) between scheduling and execution. This happens
             * when the component unmounts right after a synchronous resolve,
             * because both refetchIfNeeded and the deferred deleteQuery use
             * setTimeout(fn, 0) and their execution order is
             * non-deterministic. Without this guard the stale callback
             * would trigger queryFnAsync on a defunct entry, creating an
             * orphaned take(1) subscriber that later resolves with
             * accumulated old data.
             */
            if (queryCacheEntry?.isCompleted) return

            queryClient?.refetchQueries({
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

              /**
               * A stream that completes without data is considered cancelled.
               * This is the expected behavior if someone for example adds a takeUntil().
               * This also allow the query to be retried automatically instead of
               * resolving as success with `undefined` (which is no-op for react-query)
               * or erroring with arbitrary value.
               */
              return reject(new CancelledError())
            }

            resolve(queryCacheEntry.lastData.value as TQueryFnData)

            refetchIfNeeded()
          },
        })
    })
  }
}
