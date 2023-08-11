import { type Observable } from "rxjs"

export interface QueryResult<T> {
  data: { result: T } | undefined
  fetchStatus: "fetching" | "paused" | "idle"
  status: "loading" | "error" | "success"
  error: unknown
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Query {}

export type QueryFn<T> =
  | (() => Promise<T>)
  | (() => Observable<T>)
  | Observable<T>

export interface QueryOptions<R = unknown> {
  enabled?: boolean
  retry?: false | number | ((attempt: number, error: unknown) => boolean)
  /**
   * @important
   * The hook with the lowest value will be taken into account
   */
  staleTime?: number
  cacheTime?: number
  terminateOnFirstResult?: boolean
  onError?: (error: unknown) => void
  onSuccess?: (data: R) => void
}
