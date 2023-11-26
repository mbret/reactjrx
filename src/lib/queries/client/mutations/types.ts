import { type MonoTypeOperatorFunction, type Observable } from "rxjs"
import { type Query, type QueryResult } from "../types"

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

export interface MutationResult<R> {
  data: R | undefined
  status: "idle" | "pending" | "error" | "success"
  error: unknown
}

export interface MutationObservedResult<R> extends MutationResult<R> {
  isError: boolean
  isIdle: boolean
  isSuccess: boolean
  isPending: boolean
  isPaused: boolean
}

export type MutationFn<T, MutationArg> =
  | ((arg: MutationArg) => Promise<T>)
  | ((arg: MutationArg) => Observable<T>)

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
  mutationKey: string
  mapOperator?: MapOperator
  __queryInitHook?: MonoTypeOperatorFunction<any>
  __queryRunnerHook?: MonoTypeOperatorFunction<any>
  __queryTriggerHook?: MonoTypeOperatorFunction<Partial<Result>>
  __queryFinalizeHook?: MonoTypeOperatorFunction<Partial<Result>>
}
