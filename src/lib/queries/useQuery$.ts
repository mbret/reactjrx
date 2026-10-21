import {
  type DefaultError,
  type QueryClient,
  type QueryKey,
  type UseQueryOptions,
  useQuery,
} from "@tanstack/react-query"
import {
  createObservableQueryFn,
  type ObservableQueryFn,
} from "./createObservableQueryFn"

/**
 * TanStack's `UseQueryOptions`, with an Observable-based `queryFn` (see
 * {@link ObservableQueryFn}).
 */
export type UseQuery$Options<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, "queryFn"> & {
  queryFn: ObservableQueryFn<TQueryFnData, TQueryKey>
}

export function useQuery$<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  {
    queryFn,
    ...options
  }: UseQuery$Options<TQueryFnData, TError, TData, TQueryKey>,
  queryClient?: QueryClient,
) {
  const result = useQuery<TQueryFnData, TError, TData, TQueryKey>(
    {
      ...options,
      queryFn: createObservableQueryFn(queryFn),
    },
    queryClient,
  )

  return result
}
