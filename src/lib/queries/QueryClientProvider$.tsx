import {
  hashKey,
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
  public readonly queryMap: Map<string, CacheEntry> = new Map()

  constructor(public readonly queryClient: QueryClient) {}

  getQuery(queryHash: string) {
    return this.queryMap.get(queryHash)
  }

  setQuery(
    queryKey: QueryKey,
    query$: Observable<unknown>,
    signal: AbortSignal,
  ) {
    const queryHash = hashKey(queryKey)

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

    this.queryMap.set(queryHash, cacheEntry)

    const sub = sharedQuery$.subscribe({
      next: (data) => {
        const entry = this.queryMap.get(queryHash)

        if (entry) {
          entry.lastData = { value: data }
        }
      },
      complete: () => {
        if (this.queryMap.get(queryHash) === cacheEntry) {
          this.deleteQuery(queryHash)
        }
      },
    })

    cacheEntry.sub = sub

    return cacheEntry
  }

  deleteQuery(queryHash: string) {
    const entry = this.queryMap.get(queryHash)

    if (!entry) return

    entry.isCompleted = true

    this.queryMap.delete(queryHash)

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
     */
    if (!entry.signal.aborted && entry.lastData !== undefined) {
      this.queryClient?.cancelQueries({
        queryKey: entry.queryKey,
        exact: true,
      })
    }
  }

  destroy() {
    this.queryMap.forEach((_, key) => {
      this.deleteQuery(key)
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
          client.deleteQuery(event.query.queryHash)
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
