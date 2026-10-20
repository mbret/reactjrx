import {
  CancelledError,
  type Query,
  type QueryFunctionContext,
  type QueryKey,
} from "@tanstack/react-query"
import { createContext, memo, useContext, useEffect, useState } from "react"
import { type Observable, Subscription } from "rxjs"

type CacheEntry = {
  /**
   * Tears the stream down and detaches the entry from the query cache.
   * `invalidate` marks the query stale when it stops tracking a live stream,
   * so the next observer refetches instead of trusting a frozen value.
   */
  stop: (options?: { invalidate?: boolean }) => void
  /**
   * Set when the stream errored, or emitted `undefined`, after its first
   * value. No fetch is in flight to carry the error then, so the entry starts
   * one and that fetch rejects with it.
   */
  error: { value: unknown } | undefined
}

export class QueryClient$ {
  /**
   * One entry per query whose stream is running, keyed by the query's own
   * `queryKey` array: the one TanStack passes to `queryFn` and exposes as
   * `query.queryKey`. Entries therefore match their query whatever its
   * `queryKeyHashFn`, and nothing is hashed.
   */
  public readonly queryMap: Map<QueryKey, CacheEntry> = new Map()

  /**
   * Runs one fetch of a query backed by an Observable.
   *
   * The fetch resolves with the stream's first value. The stream then keeps
   * running and writes every later value straight into the query, the same
   * way `queryClient.setQueryData` does, so the cache always holds the
   * latest value. It runs until it completes or errors, until the query
   * loses its last observer or leaves the cache, or until another fetch of
   * the same query replaces it: a refetch runs the `queryFn` again.
   */
  runQuery<TData>(
    context: QueryFunctionContext,
    source$: Observable<TData>,
  ): Promise<TData> {
    const { queryKey, signal } = context
    const previous = this.queryMap.get(queryKey)

    previous?.stop()

    if (previous?.error) {
      return Promise.reject(previous.error.value)
    }

    const queryCache = context.client.getQueryCache()
    /**
     * Matched by identity: `context.queryKey` is the very array the query
     * holds, so this skips the key hashing a `queryKey` filter would do and
     * finds the query whatever its `queryKeyHashFn`.
     */
    const query: Query | undefined = queryCache
      .getAll()
      .find((query) => query.queryKey === queryKey)

    return new Promise<TData>((resolve, reject) => {
      /**
       * - pending: waiting for the first value.
       * - resolved: the fetch resolved with the first value, TanStack has not
       *   written it into the query yet. Later values wait in `uncommitted`,
       *   since writing them now would be overwritten by that commit.
       * - committed: later values go straight into the query.
       */
      let phase: "pending" | "resolved" | "committed" = "pending"
      let uncommitted: { value: TData } | undefined
      let isStreamDone = false
      let isStopped = false

      const subscription = new Subscription()

      const stop: CacheEntry["stop"] = ({ invalidate = false } = {}) => {
        if (isStopped) return

        isStopped = true
        subscription.unsubscribe()
        unsubscribeFromCache()
        signal.removeEventListener("abort", onAbort)

        if (this.queryMap.get(queryKey) === entry) {
          this.queryMap.delete(queryKey)
        }

        if (phase === "pending") {
          reject(new CancelledError())
        }

        if (invalidate && phase === "committed" && !isStreamDone) {
          query?.invalidate()
        }
      }

      const entry: CacheEntry = { stop, error: undefined }

      /**
       * Reports an error raised after the first value through a fetch of its
       * own, so it gets TanStack's retries and error state. That fetch runs
       * the `queryFn`, which finds this entry and rejects with the error.
       */
      const reportError = (error: unknown) => {
        entry.error = { value: error }
        isStreamDone = true
        subscription.unsubscribe()

        if (phase === "committed") {
          query?.fetch().catch(() => {})
        }
      }

      const onCommit = () => {
        phase = "committed"

        if (entry.error) {
          query?.fetch().catch(() => {})

          return
        }

        if (uncommitted) {
          query?.setData(uncommitted.value, { manual: true })
          uncommitted = undefined
        }

        if (isStreamDone) {
          stop()
        } else if (query?.getObserversCount() === 0) {
          // Nothing observes the query (a refetch of an inactive one, say).
          stop({ invalidate: true })
        }
      }

      const unsubscribeFromCache = queryCache.subscribe((event) => {
        if (event.query !== query) return

        switch (event.type) {
          case "removed":
            stop()
            break
          case "observerRemoved":
            /**
             * Once resolved, the fetch either gets cancelled, which aborts
             * the signal, or commits, and `onCommit` counts the observers.
             */
            if (phase !== "resolved" && query.getObserversCount() === 0) {
              stop({ invalidate: true })
            }
            break
          case "updated":
            if (phase !== "resolved") break

            if (event.action.type === "success" && !event.action.manual) {
              onCommit()
            } else if (event.action.type === "error") {
              stop()
            }
        }
      })

      /**
       * TanStack aborts the signal when it cancels this fetch, for example
       * when the last observer unmounts before the first value.
       */
      const onAbort = () => stop()

      signal.addEventListener("abort", onAbort, { once: true })

      this.queryMap.set(queryKey, entry)

      subscription.add(
        source$.subscribe({
          next: (value) => {
            if (phase === "pending") {
              phase = "resolved"
              resolve(value)

              // Without the query there is nothing to write later values to.
              if (!query) stop()
            } else if (value === undefined) {
              /**
               * `undefined` is not valid query data: TanStack fails a fetch
               * that resolves with it, so a later value fails the query too.
               */
              reportError(
                new Error(`${JSON.stringify(queryKey)} data is undefined`),
              )
            } else if (phase === "resolved") {
              uncommitted = { value }
            } else {
              query?.setData(value, { manual: true })
            }
          },
          error: (error) => {
            if (phase === "pending") {
              reject(error)
              stop()
            } else {
              reportError(error)
            }
          },
          complete: () => {
            isStreamDone = true

            if (phase === "pending") {
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
              stop()
            } else if (phase === "committed") {
              stop()
            }
          },
        }),
      )
    })
  }

  destroy() {
    this.queryMap.forEach((entry) => {
      entry.stop({ invalidate: true })
    })
  }
}

export const Context = createContext<QueryClient$ | undefined>(undefined)

/**
 * Holds the streams of the `useQuery$` and `useQueries$` queries rendered
 * below it, and stops every stream it still runs when it unmounts.
 */
export const QueryClientProvider$ = memo(function QueryClientProvider$({
  children,
  client: _client,
}: {
  children: React.ReactNode
  client?: QueryClient$
}) {
  const [client] = useState(() => _client ?? new QueryClient$())

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
