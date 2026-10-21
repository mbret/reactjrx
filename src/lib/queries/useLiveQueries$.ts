import type { QueryClient } from "@tanstack/react-query"
import {
  type LockedLiveQueryOption,
  lockedLiveQueryOptions,
} from "./lockedLiveQueryOptions"
import {
  type QueriesOptions$,
  type QueriesResults$,
  useQueries$,
} from "./useQueries$"

/**
 * `useQueries$` for streams that stay open. Like `useLiveQuery$`, it locks
 * each query's `staleTime` to 0 and `refetchOnMount` to `"always"`.
 */
export function useLiveQueries$<
  // biome-ignore lint/suspicious/noExplicitAny: mirrors TanStack's useQueries constraint
  T extends Array<any>,
  TCombinedResult = QueriesResults$<T>,
>(
  {
    queries,
    ...options
  }: {
    queries: readonly [...QueriesOptions$<T, [], [], LockedLiveQueryOption>]
    combine?: (result: QueriesResults$<T>) => TCombinedResult
    subscribed?: boolean
  },
  queryClient?: QueryClient,
): TCombinedResult {
  const lockedQueries = queries.map((query) => ({
    ...query,
    ...lockedLiveQueryOptions,
  }))

  return useQueries$<T, TCombinedResult>(
    {
      ...options,
      /**
       * Each query only gains the options it was not allowed to set, but
       * `Array.prototype.map` widens the tuple type, which can't be
       * re-narrowed without the cast.
       */
      queries: lockedQueries as unknown as readonly [...QueriesOptions$<T>],
    },
    queryClient,
  )
}
