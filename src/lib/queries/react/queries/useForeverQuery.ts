import { type QueryClient } from "../../client/QueryClient"
import { type QueryKey } from "../../client/keys/types"
import { QueryObserver } from "../../client/queries/observer/QueryObserver"
import { type DefaultError } from "../../client/types"
import {
  type DefinedInitialDataOptions,
  type UndefinedInitialDataOptions
} from "./queryOptions"
import {
  type DefinedUseQueryResult,
  type UseQueryOptions,
  type UseQueryResult
} from "./types"
import { useBaseQuery } from "./useBaseQuery"

export function useForeverQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: UndefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
  queryClient?: QueryClient
): UseQueryResult<TData, TError>

export function useForeverQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: DefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
  queryClient?: QueryClient
): DefinedUseQueryResult<TData, TError>

export function useForeverQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  queryClient?: QueryClient
): UseQueryResult<TData, TError>

export function useForeverQuery(
  options: UseQueryOptions,
  queryClient?: QueryClient
) {
  return useBaseQuery(
    {
      refetchOnMount: "idle",
      refetchOnReconnect: false,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      ...options
    },
    QueryObserver,
    queryClient
  )
}
