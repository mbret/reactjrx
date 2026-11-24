import type { DataTag, DefaultError, QueryKey } from "@tanstack/react-query"
import type { UseQuery$Options } from "./useQuery$.ts"

/**
 * TanStack's `queryOptions` for an Observable-based `queryFn`: it returns the
 * options it is given, with `queryKey` tagged with the query's data and error
 * types. Pass the result to `useQuery$`, `useLiveQuery$` or `useQueries$`,
 * and its `queryKey` to the `QueryClient`, whose `getQueryData` and
 * `setQueryData` then take the query's data type.
 */
export function queryOptions$<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQuery$Options<TQueryFnData, TError, TData, TQueryKey>,
): UseQuery$Options<TQueryFnData, TError, TData, TQueryKey> & {
  queryKey: DataTag<TQueryKey, TQueryFnData, TError>
}

export function queryOptions$(options: unknown) {
  return options
}
