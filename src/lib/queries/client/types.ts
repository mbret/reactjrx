import { type Observable } from "rxjs"
import { type QueryKey } from "./keys/types"

export interface QueryResult<T> {
  data: { result: T } | undefined
  fetchStatus: "fetching" | "paused" | "idle"
  status: "loading" | "error" | "success"
  error: unknown
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Query {}

export interface QueryCommand<T> {
  key: QueryKey
  fn$?: Observable<QueryFn<T>>
  refetch$?: Observable<{ ignoreStale: boolean }>
  options$?: Observable<QueryOptions<T>>
}

export type QueryFn<T> =
  | (() => Promise<T>)
  | (() => Observable<T>)
  | Observable<T>

export interface QueryTrigger {
  type: string
  ignoreStale: boolean
}

export interface QueryOptions<T = unknown> {
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
        data: QueryResult<T>["data"] | undefined,
        query: Query
      ) => number | false)
  terminateOnFirstResult?: boolean
  onError?: (error: unknown) => void
  onSuccess?: (data: T) => void
}
