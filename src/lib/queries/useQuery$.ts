import {
  type DefaultError,
  type QueryClient,
  type QueryKey,
  type UseQueryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  createObservableQueryFn,
  type ObservableQueryFn,
} from "./createObservableQueryFn"
import { useQueryClient$ } from "./QueryClientProvider$"

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
  const _queryClient = useQueryClient(queryClient)
  const queryClient$ = useQueryClient$()

  const result = useQuery<TQueryFnData, TError, TData, TQueryKey>(
    {
      ...options,
      queryFn: createObservableQueryFn(queryClient$, _queryClient, queryFn),
    },
    queryClient,
  )

  return result
}
