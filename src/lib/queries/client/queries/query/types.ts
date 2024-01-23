import { type QueryKey } from "../../keys/types"
import { type DefaultError, type Register } from "../../types"
import { type FetchStatus, type QueryStatus, type QueryOptions } from "../types"
import { type Query } from "./Query"

export type FetchDirection = 'forward' | 'backward'

export interface QueryState<TData = unknown, TError = DefaultError> {
  data: TData | undefined
  dataUpdateCount: number
  dataUpdatedAt: number
  error: TError | null
  errorUpdateCount: number
  errorUpdatedAt: number
  fetchFailureCount: number
  fetchFailureReason: TError | null
  fetchMeta: FetchMeta | null
  isInvalidated: boolean
  status: QueryStatus
  fetchStatus: FetchStatus
}

export type QueryMeta = Register extends {
    queryMeta: infer TQueryMeta
  }
    ? TQueryMeta extends Record<string, unknown>
      ? TQueryMeta
      : Record<string, unknown>
    : Record<string, unknown>

export type QueryFunctionContext<
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = never
> = [TPageParam] extends [never]
  ? {
      queryKey: TQueryKey
      signal: AbortSignal
      meta: QueryMeta | undefined
    }
  : {
      queryKey: TQueryKey
      signal: AbortSignal
      pageParam: TPageParam
      direction: FetchDirection
      meta: QueryMeta | undefined
    }

export type QueryFunction<
  T = unknown,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = never
> = (context: QueryFunctionContext<TQueryKey, TPageParam>) => T | Promise<T>

export interface FetchMeta {
  fetchMore?: { direction: FetchDirection }
}

export interface FetchOptions {
  cancelRefetch?: boolean
  meta?: FetchMeta
}

export interface FetchContext<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey = QueryKey,
> {
  fetchFn: () => unknown | Promise<unknown>
  fetchOptions?: FetchOptions
  signal: AbortSignal
  options: QueryOptions<TQueryFnData, TError, TData, any>
  queryKey: TQueryKey
  state: QueryState<TData, TError>
}

export interface QueryBehavior<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> {
  onFetch: (
    context: FetchContext<TQueryFnData, TError, TData, TQueryKey>,
    query: Query,
  ) => void
}

