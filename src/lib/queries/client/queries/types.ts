import { type Observable } from "rxjs"
import { type NoInfer, type WithRequired } from "../../../utils/types"
import { type QueryKey } from "../keys/types"
import { type DefaultError } from "../types"
import { type InfiniteQueryObserverResult } from "./observer/types"
import { type Query } from "./query/Query"
import {
  type QueryMeta,
  type QueryFunction,
  type QueryFunctionContext,
  type QueryBehavior
} from "./query/types"

export declare const dataTagSymbol: unique symbol
export type DataTag<Type, Value> = Type & {
  [dataTagSymbol]: Value
}

export type Updater<TInput, TOutput> = TOutput | ((input: TInput) => TOutput)

export interface SetDataOptions {
  updatedAt?: number
}

export type QueryStatus = "pending" | "error" | "success"
export type FetchStatus = "fetching" | "paused" | "idle"
export type NetworkMode = "online" | "always" | "offlineFirst"

export type QueryKeyHashFunction<TQueryKey extends QueryKey> = (
  queryKey: TQueryKey
) => string

export type InitialDataFunction<T> = () => T | undefined

export interface ResultOptions {
  throwOnError?: boolean
}

export interface RefetchOptions extends ResultOptions {
  cancelRefetch?: boolean
}

export interface FetchNextPageOptions extends ResultOptions {
  cancelRefetch?: boolean
}

export interface FetchPreviousPageOptions extends ResultOptions {
  cancelRefetch?: boolean
}

export type NotifyOnChangeProps =
  | Array<keyof InfiniteQueryObserverResult>
  | "all"
  | (() => Array<keyof InfiniteQueryObserverResult> | "all")

export type ThrowOnError<
  TQueryFnData,
  TError,
  TQueryData,
  TQueryKey extends QueryKey
> =
  | boolean
  | ((
      error: TError,
      query: Query<TQueryFnData, TError, TQueryData, TQueryKey>
    ) => boolean)

export type QueryPersister<
  T = unknown,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = never
> = [TPageParam] extends [never]
  ? (
      queryFn: QueryFunction<T, TQueryKey, never>,
      context: QueryFunctionContext<TQueryKey>,
      query: Query
    ) => T | Promise<T>
  : (
      queryFn: QueryFunction<T, TQueryKey, TPageParam>,
      context: QueryFunctionContext<TQueryKey>,
      query: Query
    ) => T | Promise<T>

export interface QueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = never
> {
  /**
   * If `false`, failed queries will not retry by default.
   * If `true`, failed queries will retry infinitely., failureCount: num
   * If set to an integer number, e.g. 3, failed queries will retry until the failed query count meets that number.
   * If set to a function `(failureCount, error) => boolean` failed queries will retry until the function returns false.
   */
  retry?: boolean | number | ((failureCount: number, error: TError) => boolean)
  retryDelay?: number | ((failureCount: number, error: TError) => number)
  networkMode?: NetworkMode
  /**
   * The time in milliseconds that unused/inactive cache data remains in memory.
   * When a query's cache becomes unused or inactive, that cache data will be garbage collected after this duration.
   * When different garbage collection times are specified, the longest one will be used.
   * Setting it to `Infinity` will disable garbage collection.
   */
  gcTime?: number
  queryFn?: QueryFunction<TQueryFnData, TQueryKey, TPageParam> | Observable<TQueryFnData>
  persister?: QueryPersister<
    NoInfer<TQueryFnData>,
    NoInfer<TQueryKey>,
    NoInfer<TPageParam>
  >
  queryHash?: string
  queryKey?: TQueryKey
  queryKeyHashFn?: QueryKeyHashFunction<TQueryKey>
  initialData?: TData | InitialDataFunction<TData>
  initialDataUpdatedAt?: number | (() => number | undefined)
  behavior?: QueryBehavior<TQueryFnData, TError, TData, TQueryKey>
  /**
   * Set this to `false` to disable structural sharing between query results.
   * Set this to a function which accepts the old and new data and returns resolved data of the same type to implement custom structural sharing logic.
   * Defaults to `true`.
   */
  structuralSharing?: boolean | (<T>(oldData: T | undefined, newData: T) => T)
  _defaulted?: boolean
  /**
   * Additional payload to be stored on each query.
   * Use this property to pass information that can be used in other places.
   */
  meta?: QueryMeta
  /**
   * Maximum number of pages to store in the data of an infinite query.
   */
  maxPages?: number
}

export type QueryTypeFilter = "all" | "active" | "inactive"

export interface QueryFilters {
  /**
   * Filter to active queries, inactive queries or all queries
   */
  type?: QueryTypeFilter
  /**
   * Match query key exactly
   */
  exact?: boolean
  /**
   * Include queries matching this predicate function
   */
  predicate?: (query: Query) => boolean
  /**
   * Include queries matching this query key
   */
  queryKey?: QueryKey
  /**
   * Include or exclude stale queries
   */
  stale?: boolean
  /**
   * Include queries matching their fetchStatus
   */
  fetchStatus?: FetchStatus
}

export type PlaceholderDataFunction<
  TQueryFnData = unknown,
  TError = DefaultError,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> = (
  previousData: TQueryData | undefined,
  previousQuery: Query<TQueryFnData, TError, TQueryData, TQueryKey> | undefined
) => TQueryData | undefined

export interface FetchQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = never
> extends WithRequired<
    QueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>,
    "queryKey"
  > {
  /**
   * The time in milliseconds after data is considered stale.
   * If the data is fresh it will be returned from the cache.
   */
  staleTime?: number
}

export type QueriesPlaceholderDataFunction<TQueryData> = (
  previousData: undefined,
  previousQuery: undefined
) => TQueryData | undefined
