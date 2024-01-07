import { type Observable, type MonoTypeOperatorFunction } from "rxjs"
import {
  type DefaultError,
  type Query,
  type QueryResult,
  type Register
} from "../../types"
import { type MapOperator, type MutationFn, type MutationKey } from "../types"

export type MutationStatus = "idle" | "pending" | "success" | "error"

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
  ) =>
    | Promise<TContext | undefined>
    | Observable<TContext | undefined>
    | TContext
    | undefined
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
