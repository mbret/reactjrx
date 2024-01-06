import { type MonoTypeOperatorFunction, type Observable } from "rxjs"
import {
  type Register,
  type DefaultError,
  type Query,
  type QueryResult
} from "../types"
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
export interface MutationFilters<
  TData = unknown,
  TError = DefaultError,
  TVariables = any,
  TContext = unknown
> {
  /**
   * Match mutation key exactly
   */
  exact?: boolean
  /**
   * Include mutations matching this predicate function
   */
  predicate?: (
    mutation: Mutation<TData, TError, TVariables, TContext>
  ) => boolean
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

export type MutationMeta = Register extends {
  mutationMeta: infer TMutationMeta
}
  ? TMutationMeta
  : Record<string, unknown>

export interface MutationOptions<
  TData,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> {
  enabled?: boolean
  retry?: false | number | ((attempt: number, error: unknown) => boolean)
  retryDelay?: number | ((failureCount: number, error: TError) => number)
  gcTime?: number
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
        data: QueryResult<TData>["data"] | undefined,
        query: Query
      ) => number | false)
  terminateOnFirstResult?: boolean
  onMutate?: (
    variables: TVariables
  ) => Promise<TContext | undefined> | TContext | undefined
  onError?: (
    error: TError,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<unknown> | unknown
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<unknown> | unknown
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<unknown> | unknown
  mutationFn?: MutationFn<TData, TVariables>
  mutationKey?: MutationKey
  mapOperator?: MapOperator
  meta?: MutationMeta
  __queryInitHook?: MonoTypeOperatorFunction<any>
  __queryRunnerHook?: MonoTypeOperatorFunction<any>
  __queryTriggerHook?: MonoTypeOperatorFunction<Partial<TData>>
  __queryFinalizeHook?: MonoTypeOperatorFunction<Partial<TData>>
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
  failureCount: number
  failureReason: TError | null
  isPaused: boolean
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
