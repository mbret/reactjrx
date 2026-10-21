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

export function useQuery$<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  {
    queryFn,
    ...options
  }: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    "queryFn"
  > & {
    queryFn: ObservableQueryFn<TQueryFnData, TQueryKey>
  },
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
