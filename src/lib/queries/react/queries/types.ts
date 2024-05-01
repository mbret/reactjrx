import { type WithRequired } from "../../../utils/types"
import { type QueryKey } from "../../client/keys/types"
import {
  type QueryObserverResult,
  type DefinedQueryObserverResult,
  type QueryObserverOptions
} from "../../client/queries/observer/types"
import { type DefaultError } from "../../client/types"

export type DefinedUseQueryResult<
  TData = unknown,
  TError = DefaultError
> = DefinedQueryObserverResult<TData, TError>

export interface UseBaseQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> extends WithRequired<
    QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    "queryKey"
  > {}

export interface UseQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> extends Omit<
    WithRequired<
      UseBaseQueryOptions<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>,
      "queryKey"
    >,
    "suspense"
  > {}

export type UseBaseQueryResult<
  TData = unknown,
  TError = DefaultError
> = QueryObserverResult<TData, TError>

export type UseQueryResult<
  TData = unknown,
  TError = DefaultError
> = UseBaseQueryResult<TData, TError>
