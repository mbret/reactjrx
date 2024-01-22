import { type Observable } from "rxjs"
import { type QueryKey } from "./keys/types"
import { type QueryStore } from "./oldqueries/store/createQueryStore"

export interface QueryResult<T> {
  data: { result: T } | undefined
  fetchStatus: "fetching" | "paused" | "idle"
  status: "loading" | "error" | "success"
  error: unknown
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Register {}

export type DefaultError = Register extends {
  defaultError: infer TError
}
  ? TError
  : Error

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeprecatedQuery {}

export interface QueryCommand<T> {
  key: QueryKey
  fn$?: Observable<QueryFn<T>>
  refetch$?: Observable<{ ignoreStale: boolean }>
  options$?: Observable<DeprecatedQueryOptions<T>>
}

export type QueryFn<T> =
  | (() => Promise<T>)
  | (() => Observable<T>)
  | Observable<T>

export interface QueryPipelineParams<R> {
  queryStore: QueryStore
  serializedKey: string
  key: QueryKey
  options$: Observable<DeprecatedQueryOptions<R>>
}

/**
 * Events that trigger stream chain of query.
 * What will happens then depends of what event is triggered
 * and subsequent variables. This is just standardized way
 * of what trigger a query.
 */
export type QueryTrigger =
  | { type: "initial" }
  | {
      type: "refetch"
      ignoreStale: boolean
    }
  | {
      type: "enabled"
    }

export interface DeprecatedQueryOptions<T = unknown, TError = DefaultError> {
  enabled?: boolean
  retry?: false | number | ((attempt: number, error: unknown) => boolean)
  retryDelay?: number | ((failureCount: number, error: TError) => number)
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
        data: QueryResult<T>["data"] | undefined,
        query: DeprecatedQuery
      ) => number | false)
  terminateOnFirstResult?: boolean
  onError?: (error: unknown) => void
  onSuccess?: (data: T) => void
}
