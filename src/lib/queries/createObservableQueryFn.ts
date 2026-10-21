import {
  CancelledError,
  type QueryFunctionContext,
  type QueryKey,
  skipToken,
} from "@tanstack/react-query"
import { defer, type Observable, Subscription } from "rxjs"

export type ObservableQueryFn<
  TQueryFnData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> =
  | ((context: QueryFunctionContext<TQueryKey>) => Observable<TQueryFnData>)
  | typeof skipToken
  | Observable<TQueryFnData>

/**
 * Bridges an Observable-based `queryFn` to the Promise-based `queryFn`
 * expected by TanStack Query. Shared by `useQuery$` and `useQueries$`.
 *
 * As with TanStack's `streamedQuery`, the whole stream is one fetch: every
 * value is written into the query as soon as the stream emits it, the query
 * stays `fetching` until the stream completes, and the fetch then resolves
 * with the last value. Cancelling the fetch (the last observer unmounting,
 * `cancelQueries`, a refetch, the query leaving the cache) unsubscribes from
 * the stream.
 */
export function createObservableQueryFn<
  TQueryFnData = unknown,
  TQueryKey extends QueryKey = QueryKey,
>(queryFn: ObservableQueryFn<TQueryFnData, TQueryKey> | undefined) {
  if (queryFn === skipToken || queryFn === undefined) {
    return queryFn
  }

  return (context: QueryFunctionContext<TQueryKey>) =>
    new Promise<TQueryFnData>((resolve, reject) => {
      const { queryKey, signal } = context
      /**
       * Matched by identity: `context.queryKey` is the very array the query
       * holds, so nothing is hashed and the query is found whatever its
       * `queryKeyHashFn`.
       */
      const query = context.client
        .getQueryCache()
        .getAll()
        .find((query) => query.queryKey === queryKey)
      const subscription = new Subscription()
      let last: { value: TQueryFnData } | undefined
      let isSubscribing = true

      /**
       * TanStack aborts the signal when it cancels the fetch, which it can
       * still do after the stream completed, until it has settled the fetch.
       * The values the stream wrote stay in the cache but no longer follow
       * it, so the query is marked stale: the next observer that needs it
       * refetches, whatever its `staleTime`.
       */
      const onAbort = () => {
        subscription.unsubscribe()

        if (last) query?.invalidate()

        reject(new CancelledError())
      }

      /**
       * TanStack only cancels a fetch when the last observer of its query
       * leaves, so nothing would ever stop the stream of a query without
       * observers (a `refetchQueries` of an inactive one, say). Such a fetch
       * takes the stream's current value and finishes.
       */
      const isObserved = () =>
        query !== undefined && query.getObserversCount() > 0

      const resolveWithLast = () => {
        if (!last) return

        subscription.unsubscribe()
        resolve(last.value)
      }

      signal.addEventListener("abort", onAbort, { once: true })

      subscription.add(
        defer(() =>
          typeof queryFn === "function" ? queryFn(context) : queryFn,
        ).subscribe({
          next: (value) => {
            if (value === undefined) {
              // `undefined` is not valid query data, as for any fetch result.
              subscription.unsubscribe()
              reject(new Error(`${JSON.stringify(queryKey)} data is undefined`))

              return
            }

            last = { value }

            if (isObserved()) {
              query?.setData(value, { manual: true })
            } else if (!isSubscribing) {
              resolveWithLast()
            }
          },
          error: (error) => {
            subscription.unsubscribe()
            reject(error)
          },
          complete: () => {
            subscription.unsubscribe()

            if (last) {
              resolve(last.value)

              return
            }

            console.warn(
              `cancelled due to stream completing without data for query ${JSON.stringify(queryKey)}`,
            )

            /**
             * A stream that completes without data is considered cancelled.
             * This is the expected behavior if someone for example adds a takeUntil().
             * This also allow the query to be retried automatically instead of
             * resolving as success with `undefined` (which is no-op for react-query)
             * or erroring with arbitrary value.
             */
            reject(new CancelledError())
          },
        }),
      )

      isSubscribing = false

      // An unobserved query keeps the last of the values emitted on subscribe.
      if (!subscription.closed && !isObserved()) resolveWithLast()
    })
}
