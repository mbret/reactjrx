/**
 * What `useLiveQuery$` and `useLiveQueries$` lock, so that no default of the
 * `QueryClient` keeps a live query from reopening its stream: its data is
 * stale as soon as no stream backs it, and every mount fetches, which joins a
 * running stream or reopens a stopped one.
 */
export const lockedLiveQueryOptions = {
  staleTime: 0,
  refetchOnMount: "always",
} as const

export type LockedLiveQueryOption = keyof typeof lockedLiveQueryOptions
