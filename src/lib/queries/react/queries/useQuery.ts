"use client"
import { type QueryClient } from "../../client/QueryClient"
import { type QueryKey } from "../../client/keys/types"
import { QueryObserver } from "../../client/queries/observer/QueryObserver"
import { type DefaultError } from "../../client/types"
import { type DefinedInitialDataOptions, type UndefinedInitialDataOptions } from "./queryOptions"
import { type DefinedUseQueryResult, type UseQueryOptions, type UseQueryResult } from "./types"
import { useBaseQuery } from "./useBaseQuery"

export function useQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: UndefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
  queryClient?: QueryClient
): UseQueryResult<TData, TError>

export function useQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: DefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
  queryClient?: QueryClient
): DefinedUseQueryResult<TData, TError>

export function useQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  queryClient?: QueryClient
): UseQueryResult<TData, TError>

export function useQuery(options: UseQueryOptions, queryClient?: QueryClient) {
  return useBaseQuery(options, QueryObserver, queryClient)
}
