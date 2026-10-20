import {
  type QueryClient,
  type QueryKey,
  useQueryClient,
} from "@tanstack/react-query"
import { createContext, memo, useContext, useEffect, useState } from "react"
import {
  fromEvent,
  type Observable,
  type Subscription,
  share,
  takeUntil,
} from "rxjs"

type CacheEntry = {
  queryKey: QueryKey
  query$: Observable<unknown>
  signal: AbortSignal
  sub: Subscription | undefined
  isCompleted: boolean
  lastData: { value: unknown } | undefined
}

export class QueryClient$ {
  /**
   * Keyed by the query's own `queryKey` array: the one TanStack passes to
   * `queryFn` and exposes as `query.queryKey`. Entries therefore match their
   * query whatever its `queryKeyHashFn`, and nothing is hashed.
   */
  public readonly queryMap: Map<QueryKey, CacheEntry> = new Map()

  constructor(public readonly queryClient: QueryClient) {}

  getQuery(queryKey: QueryKey) {
    return this.queryMap.get(queryKey)
  }

  setQuery(
    queryKey: QueryKey,
    query$: Observable<unknown>,
    signal: AbortSignal,
  ) {
    const sharedQuery$ = query$.pipe(
      takeUntil(fromEvent(signal, "abort")),
      share(),
    )

    const cacheEntry: CacheEntry = {
      queryKey,
      query$: sharedQuery$,
      signal,
      sub: undefined,
      isCompleted: false,
      lastData: undefined,
    }

    this.queryMap.set(queryKey, cacheEntry)

    const sub = sharedQuery$.subscribe({
      /**
       * Write on the closed-over entry directly: this subscription is torn
       * down by `deleteQuery` before the map slot can ever point to another
       * entry, so a per-emission `queryMap.get(queryKey)` lookup would
       * always resolve to `cacheEntry` anyway.
       */
      next: (data) => {
        cacheEntry.lastData = { value: data }
      },
      complete: () => {
        if (this.queryMap.get(queryKey) === cacheEntry) {
          this.deleteQuery(queryKey)
        }
      },
    })

    cacheEntry.sub = sub

    return cacheEntry
  }

  deleteQuery(
    queryKey: QueryKey,
    { cancelQuery = false }: { cancelQuery?: boolean } = {},
  ) {
    const entry = this.queryMap.get(queryKey)

    if (!entry) return

    entry.isCompleted = true

    this.queryMap.delete(queryKey)

    if (entry.sub) {
      entry.sub.unsubscribe()
      entry.sub = undefined
    }

    /**
     * Only cancel queries whose stream already emitted at least once.
     * Those are "live" streams stuck in the take(1) refetch loop and
     * need an explicit cancel so the pending queryFnAsync promise
     * settles. One-shot observables (used like promises) that haven't
     * resolved yet should keep react-query's default behavior: stay
     * pending and resolve naturally even after unmount.
     *
     * Skipped on natural completion (cancelQuery=false) because the
     * in-flight queryFnAsync promise is about to resolve with the
     * final value — cancelling it would reject it prematurely.
     */
    if (cancelQuery && !entry.signal.aborted && entry.lastData !== undefined) {
      /**
       * Matched by identity for the same reason as the refetch path: the
       * `{ queryKey, exact: true }` filter re-hashes the key for every
       * query in the cache, while an identity predicate skips hashing and
       * keeps all cancel semantics inside `cancelQueries`.
       */
      this.queryClient?.cancelQueries({
        predicate: (query) => query.queryKey === entry.queryKey,
      })
    }
  }

  destroy() {
    this.queryMap.forEach((_, key) => {
      this.deleteQuery(key, { cancelQuery: true })
    })
  }
}

export const Context = createContext<QueryClient$ | undefined>(undefined)

/**
 * Must render **inside** TanStack `QueryClientProvider` (or equivalent).
 * Subscribes to that client's query cache so when a query is removed
 * (including via `queryClient.clear()`), matching `useQuery$` observable
 * entries are dropped.
 */
export const QueryClientProvider$ = memo(function QueryClientProvider$({
  children,
  client: _client,
}: {
  children: React.ReactNode
  client?: QueryClient$
}) {
  const queryClient = useQueryClient()
  const [client] = useState(() => _client ?? new QueryClient$(queryClient))

  useEffect(
    function subscribeToQueryCache() {
      return queryClient.getQueryCache().subscribe((event) => {
        const activeObservers = event.query.getObserversCount()

        /**
         * When all observers unmount we need to delete the query from the cache
         * because if the query contains a stream, it will continue. Nothing stops it.
         * However this is only valid when there is no more observers.
         */
        if (event.type === "observerRemoved" && activeObservers === 0) {
          client.deleteQuery(event.query.queryKey, { cancelQuery: true })
        }
      })
    },
    [queryClient, client],
  )

  useEffect(() => {
    return () => {
      client.destroy()
    }
  }, [client])

  return <Context.Provider value={client}>{children}</Context.Provider>
})

export const useQueryClient$ = () => {
  const client = useContext(Context)

  if (!client) {
    throw new Error(
      "useReactJrxQueryClient must be used within a ReactJrxQueryProvider",
    )
  }

  return client
}
