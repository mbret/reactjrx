import {
  CancelledError,
  type Query,
  type QueryCache,
  type QueryFunctionContext,
  type QueryKey,
  skipToken,
} from "@tanstack/react-query"
import { defer, type Observable, Subscription, take } from "rxjs"

export type ObservableQueryFn<
  TQueryFnData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> =
  | ((context: QueryFunctionContext<TQueryKey>) => Observable<TQueryFnData>)
  | typeof skipToken
  | Observable<TQueryFnData>

/**
 * A fetch of the query whose stream it settles: either a fetch TanStack
 * started, which ends with the stream's first value, or the fetch that
 * follows the stream while it runs.
 */
type StreamFetch = {
  isFollow: boolean
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
}

/**
 * A query's stream while it runs. It outlives the fetches it settles, so a
 * refetch takes it over instead of subscribing to the source again.
 */
type Stream = {
  /**
   * - loading: the fetch that owns the stream waits for its first value.
   * - resolved: that fetch resolved, but TanStack has not stored its value
   *   yet. That commit overwrites the values written after it with the one
   *   the fetch resolved with, so the latest is kept in `uncommitted` and
   *   written again right after it.
   * - live: the fetch that follows the stream owns it.
   */
  phase: "loading" | "resolved" | "live"
  last: { value: unknown } | undefined
  uncommitted: { value: unknown } | undefined
  error: { value: unknown } | undefined
  isComplete: boolean
  fetch: StreamFetch | undefined
  /** Set while the bridge starts the fetch that follows the stream. */
  isStartingFollow: boolean
  stop: (options?: { invalidate?: boolean }) => void
}

const streams = new WeakMap<Query, Stream>()

/**
 * Bridges an Observable-based `queryFn` to the Promise-based `queryFn`
 * expected by TanStack Query. Shared by `useQuery$` and `useQueries$`.
 *
 * Every value is written into the query as soon as the stream emits it. A
 * fetch TanStack starts (mount, `refetch()`, `invalidateQueries()`...) ends
 * once the stream has a value in the cache, like a regular query, so awaiting
 * it settles. Right after it, the bridge starts a fetch that follows the
 * stream: it keeps the query `fetching` while the stream runs and ends when
 * the stream completes or errors. A refetch takes over a running stream and
 * settles with its current value. Cancelling the fetch in progress (the last
 * observer unmounting, `cancelQueries`, the query leaving the cache) stops
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
      const queryCache = context.client.getQueryCache()
      /**
       * Matched by identity: `context.queryKey` is the very array the query
       * holds, so nothing is hashed and the query is found whatever its
       * `queryKeyHashFn`.
       */
      const query = queryCache
        .getAll()
        .find((query) => query.queryKey === context.queryKey)
      const source$: Observable<unknown> = defer(() =>
        typeof queryFn === "function" ? queryFn(context) : queryFn,
      )
      const settle = {
        resolve: resolve as (value: unknown) => void,
        reject,
      }

      if (!query) {
        // The query left the cache while an observer still fetches it, so
        // nothing holds later values: the fetch takes the first one.
        settleWithFirstValue(source$, context.signal, settle)

        return
      }

      const running = streams.get(query)
      const fetch: StreamFetch = {
        isFollow: running?.isStartingFollow ?? false,
        ...settle,
      }

      if (running) {
        running.isStartingFollow = false
        takeOver(running, fetch)
      } else {
        startStream(query, queryCache, source$, fetch)
      }

      const stream = streams.get(query)

      if (stream?.fetch === fetch) watchAbort(stream, fetch, context.signal)
    })
}

function settleWithFirstValue(
  source$: Observable<unknown>,
  signal: AbortSignal,
  { resolve, reject }: Pick<StreamFetch, "resolve" | "reject">,
) {
  const subscription = source$.pipe(take(1)).subscribe({
    next: resolve,
    error: reject,
    complete: () => reject(new CancelledError()),
  })

  signal.addEventListener(
    "abort",
    () => {
      subscription.unsubscribe()
      reject(new CancelledError())
    },
    { once: true },
  )
}

function takeOver(stream: Stream, fetch: StreamFetch) {
  stream.fetch = fetch

  if (stream.error) {
    fetch.reject(stream.error.value)
    stream.stop()
  } else if (fetch.isFollow) {
    if (stream.isComplete) {
      fetch.resolve(stream.last?.value)
      stream.stop()
    }
  } else if (stream.last) {
    // A refetch of a running stream settles with its current value.
    stream.phase = "resolved"
    fetch.resolve(stream.last.value)
  } else {
    stream.phase = "loading"
  }
}

/**
 * TanStack aborts the signal when it cancels the fetch. A refetch cancels the
 * fetch in progress and starts its own right away, which takes the stream
 * over. Anything else that cancels it (the last observer leaving,
 * `cancelQueries`, the query leaving the cache) stops the stream. The values
 * it wrote stay in the cache but no longer follow it, so the query is marked
 * stale: the next observer that needs it refetches, whatever its `staleTime`.
 */
function watchAbort(stream: Stream, fetch: StreamFetch, signal: AbortSignal) {
  signal.addEventListener(
    "abort",
    () => {
      if (stream.fetch !== fetch) return

      stream.fetch = undefined
      fetch.reject(new CancelledError())

      queueMicrotask(() => {
        if (!stream.fetch && !stream.isStartingFollow) {
          stream.stop({ invalidate: true })
        }
      })
    },
    { once: true },
  )
}

function startStream(
  query: Query,
  queryCache: QueryCache,
  source$: Observable<unknown>,
  fetch: StreamFetch,
) {
  const subscription = new Subscription()
  let isStopped = false

  const stream: Stream = {
    phase: "loading",
    last: undefined,
    uncommitted: undefined,
    error: undefined,
    isComplete: false,
    fetch,
    isStartingFollow: false,
    stop: ({ invalidate = false } = {}) => {
      if (isStopped) return

      isStopped = true
      subscription.unsubscribe()
      unsubscribeFromCache()

      if (streams.get(query) === stream) streams.delete(query)

      if (invalidate && stream.last) query.invalidate()
    },
  }

  const fail = (error: unknown) => {
    subscription.unsubscribe()
    stream.error = { value: error }

    // A resolved fetch can no longer fail: the fetch that follows reports it.
    if (stream.phase === "resolved" || stream.isStartingFollow) return

    stream.fetch?.reject(error)
    stream.stop()
  }

  const onCommit = () => {
    stream.phase = "live"
    stream.fetch = undefined

    if (stream.uncommitted) {
      query.setData(stream.uncommitted.value, { manual: true })
      stream.uncommitted = undefined
    }

    if (stream.isComplete && !stream.error) {
      stream.stop()
    } else if (!stream.error && query.getObserversCount() === 0) {
      // Nothing observes the query (a refetch of an inactive one, say), so
      // nothing would ever cancel the fetch that follows the stream.
      stream.stop({ invalidate: true })
    } else {
      stream.isStartingFollow = true
      query.fetch().catch(() => {})
    }
  }

  const unsubscribeFromCache = queryCache.subscribe((event) => {
    if (event.query !== query) return

    if (
      event.type === "updated" &&
      stream.phase === "resolved" &&
      event.action.type === "success" &&
      !event.action.manual
    ) {
      onCommit()
    }

    /**
     * A follow fetch that has not run yet (paused while offline, say) has no
     * signal TanStack could abort, so stop the stream here instead.
     */
    if (
      (event.type === "observerRemoved" &&
        !stream.fetch &&
        query.getObserversCount() === 0) ||
      event.type === "removed"
    ) {
      stream.stop({ invalidate: event.type === "observerRemoved" })
    }
  })

  streams.set(query, stream)

  subscription.add(
    source$.subscribe({
      next: (value) => {
        if (value === undefined) {
          // `undefined` is not valid query data, as for any fetch result.
          fail(new Error(`${JSON.stringify(query.queryKey)} data is undefined`))

          return
        }

        stream.last = { value }

        // Cancelled: a refetch that takes the stream over settles with it.
        if (!stream.fetch && !stream.isStartingFollow) return

        query.setData(value, { manual: true })

        if (stream.phase === "loading") {
          stream.phase = "resolved"
          stream.fetch?.resolve(value)
        } else if (stream.phase === "resolved") {
          stream.uncommitted = { value }
        }
      },
      error: fail,
      complete: () => {
        stream.isComplete = true

        // Settled when TanStack stores the resolved value, or by the follow.
        if (stream.phase === "resolved" || stream.isStartingFollow) return

        if (stream.last) {
          stream.fetch?.resolve(stream.last.value)
        } else {
          console.warn(
            `cancelled due to stream completing without data for query ${JSON.stringify(query.queryKey)}`,
          )

          /**
           * A stream that completes without data is considered cancelled.
           * This is the expected behavior if someone for example adds a takeUntil().
           * This also allow the query to be retried automatically instead of
           * resolving as success with `undefined` (which is no-op for react-query)
           * or erroring with arbitrary value.
           */
          stream.fetch?.reject(new CancelledError())
        }

        stream.stop()
      },
    }),
  )
}
