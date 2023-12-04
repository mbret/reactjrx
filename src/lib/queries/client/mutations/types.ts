import { type MonoTypeOperatorFunction, type Observable } from "rxjs"
import { type DefaultError, type Query, type QueryResult } from "../types"
import { type Mutation } from "./Mutation"

/**
 * The default value `merge` is suitable for most use case.
 * You should not have to worry too much about it and only consider changing
 * it when specific need arise.
 *
 * `merge`:
 * Run each async query as they are triggered without any cancellation or queue system.
 * The result is always from the latest async query triggered, not necessarily
 * the latest one running.
 *
 * `concat`:
 * Unlike merge, it will trigger each async query sequentially following
 * a queue system. The result is not necessarily the last triggered async query
 * but the current running async query.
 *
 * `switch`:
 * Only run the latest async query triggered and cancel any previously running one.
 * Result correspond to the current running async query.
 */
export type MapOperator = "switch" | "concat" | "merge"

export type MutationStatus = "idle" | "pending" | "success" | "error"

export type MutationKey = unknown[]

/**
 * @todo this should be used in a lot of place so we can probably make a helper for that
 */
export interface MutationFilters<TData> {
  /**
   * Match mutation key exactly
   */
  // exact?: boolean
  /**
   * Include mutations matching this predicate function
   */
  predicate?: (mutation: Mutation<TData>) => boolean
  /**
   * Include mutations matching this mutation key
   */
  mutationKey?: MutationKey
  /**
   * Filter by mutation status
   */
  status?: MutationStatus
}

export type MutationFn<Data, MutationArg> =
  | Observable<Data>
  | ((arg: MutationArg) => Promise<Data>)
  | ((arg: MutationArg) => Observable<Data>)

export interface MutationOptions<Result, MutationArg> {
  enabled?: boolean
  retry?: false | number | ((attempt: number, error: unknown) => boolean)
  /**
   * @important
   * The hook with the lowest value will be taken into account
   */
  staleTime?: number
  /**
   * Force the new query to be marked as stale. Only on first trigger
   */
  markStale?: boolean
  cacheTime?: number
  /**
   * @important
   * interval is paused until the query finish fetching. This avoid infinite
   * loop of refetch
   */
  refetchInterval?:
    | number
    | false
    | ((
        data: QueryResult<Result>["data"] | undefined,
        query: Query
      ) => number | false)
  terminateOnFirstResult?: boolean
  onError?: (error: unknown, arg: MutationArg) => void
  onSuccess?: (data: Result, arg: MutationArg) => void
  mutationFn: MutationFn<Result, MutationArg>
  mutationKey: MutationKey
  mapOperator?: MapOperator
  __queryInitHook?: MonoTypeOperatorFunction<any>
  __queryRunnerHook?: MonoTypeOperatorFunction<any>
  __queryTriggerHook?: MonoTypeOperatorFunction<Partial<Result>>
  __queryFinalizeHook?: MonoTypeOperatorFunction<Partial<Result>>
}

export interface MutationState<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> {
  context: TContext | undefined
  data: TData | undefined
  error: TError | null
  status: MutationStatus
  variables: TVariables | undefined
  submittedAt: number
}

export interface MutateOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> {
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void
  onError?: (
    error: TError,
    variables: TVariables,
    context: TContext | undefined
  ) => void
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext | undefined
  ) => void
}

export type MutateFunction<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> = (
  variables: TVariables,
  options?: MutateOptions<TData, TError, TVariables, TContext>
) => Promise<TData>

export interface MutationObserverBaseResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationState<TData, TError, TVariables, TContext> {
  isError: boolean
  isIdle: boolean
  isPending: boolean
  isSuccess: boolean
}

export interface MutationObserverIdleResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationObserverBaseResult<TData, TError, TVariables, TContext> {
  data: undefined
  variables: undefined
  error: null
  isError: false
  isIdle: true
  isPending: false
  isSuccess: false
  status: "idle"
}

export interface MutationObserverLoadingResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationObserverBaseResult<TData, TError, TVariables, TContext> {
  data: undefined
  variables: TVariables
  error: null
  isError: false
  isIdle: false
  isPending: true
  isSuccess: false
  status: "pending"
}

export interface MutationObserverErrorResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationObserverBaseResult<TData, TError, TVariables, TContext> {
  data: undefined
  error: TError
  variables: TVariables
  isError: true
  isIdle: false
  isPending: false
  isSuccess: false
  status: "error"
}

export interface MutationObserverSuccessResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationObserverBaseResult<TData, TError, TVariables, TContext> {
  data: TData
  error: null
  variables: TVariables
  isError: false
  isIdle: false
  isPending: false
  isSuccess: true
  status: "success"
}

export interface MutationObserverAnyResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationObserverBaseResult<TData, TError, TVariables, TContext> {
  data: TData | undefined
  error: TError | null
  variables: TVariables
  isError: boolean
  isIdle: boolean
  isPending: boolean
  isSuccess: boolean
  status: MutationStatus
}

export type MutationObserverResult<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> = MutationObserverAnyResult<TData, TError, TVariables, TContext>
// | MutationObserverLoadingResult<TData, TError, TVariables, TContext>
// | MutationObserverErrorResult<TData, TError, TVariables, TContext>
// | MutationObserverSuccessResult<TData, TError, TVariables, TContext>
