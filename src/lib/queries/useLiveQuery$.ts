import type { DefaultError, QueryClient, QueryKey } from "@tanstack/react-query"
import {
  type LockedLiveQueryOption,
  lockedLiveQueryOptions,
} from "./lockedLiveQueryOptions"
import { type UseQuery$Options, useQuery$ } from "./useQuery$"

/**
 * `useQuery$` for a stream that stays open, such as a live database query or
 * a socket. It locks `staleTime` to 0 and `refetchOnMount` to `"always"`, so
 * whatever the `QueryClient`'s defaults, the query reopens its stream
 * whenever a component needs it again.
 */
export function useLiveQuery$<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: Omit<
    UseQuery$Options<TQueryFnData, TError, TData, TQueryKey>,
    LockedLiveQueryOption
  >,
  queryClient?: QueryClient,
) {
  return useQuery$<TQueryFnData, TError, TData, TQueryKey>(
    { ...options, ...lockedLiveQueryOptions },
    queryClient,
  )
}
