import { type Observable } from "rxjs"
import { type QueryKey } from "../../keys/types"
import { type DefaultError, type Register } from "../../types"
import { type FetchStatus, type QueryStatus, type QueryOptions } from "../types"
import { type Query } from "./Query"

export interface SetStateOptions {
  meta?: any
}

export type FetchDirection = "forward" | "backward"

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
      pageParam?: unknown
      direction?: "forward" | "backward"
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
> =
  | ((
      context: QueryFunctionContext<TQueryKey, TPageParam>
    ) => T | Promise<T> | Observable<T>)
  | Observable<T>

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
  TQueryKey extends QueryKey = QueryKey
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
  TQueryKey extends QueryKey = QueryKey
> {
  onFetch: (
    context: FetchContext<TQueryFnData, TError, TData, TQueryKey>,
    query: Query
  ) => void
}

interface FailedAction<TError> {
  type: "failed"
  failureCount: number
  error: TError
}

interface FetchAction {
  type: "fetch"
  meta?: FetchMeta
}

interface SuccessAction<TData> {
  data: TData | undefined
  type: "success"
  dataUpdatedAt?: number
  manual?: boolean
}

interface ErrorAction<TError> {
  type: "error"
  error: TError
}

interface InvalidateAction {
  type: "invalidate"
}

interface PauseAction {
  type: "pause"
}

interface ContinueAction {
  type: "continue"
}

interface SetStateAction<TData, TError> {
  type: "setState"
  state: Partial<QueryState<TData, TError>>
  setStateOptions?: SetStateOptions
}

export type Action<TData, TError> =
  | ContinueAction
  | ErrorAction<TError>
  | FailedAction<TError>
  | FetchAction
  | InvalidateAction
  | PauseAction
  | SetStateAction<TData, TError>
  | SuccessAction<TData>
