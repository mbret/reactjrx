import { type Observable } from "rxjs"
import { type DefaultError } from "../types"
import { type Mutation } from "./mutation/Mutation"
import { type MutationStatus } from "./mutation/types"

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
