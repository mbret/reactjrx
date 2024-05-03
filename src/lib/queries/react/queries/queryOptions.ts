import { type QueryKey } from "../../client/keys/types"
import { type DataTag } from "../../client/queries/types"
import { type DefaultError } from "../../client/types"
import type { UseQueryOptions } from "./types"

export type UndefinedInitialDataOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = never
> = UseQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam> & {
  initialData?: undefined
}

type NonUndefinedGuard<T> = T extends undefined ? never : T

export type DefinedInitialDataOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> = UseQueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
  initialData:
    | NonUndefinedGuard<TQueryFnData>
    | (() => NonUndefinedGuard<TQueryFnData>)
}

export function queryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: DefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>
): DefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey> & {
  queryKey: DataTag<TQueryKey, TQueryFnData>
}

export function queryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = never
>(
  options: UndefinedInitialDataOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey,
    TPageParam
  >
): UndefinedInitialDataOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey,
  TPageParam
> & {
  queryKey: DataTag<TQueryKey, TQueryFnData>
}

export function queryOptions(options: unknown) {
  return options
}
