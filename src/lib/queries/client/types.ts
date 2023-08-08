import { type Observable } from "rxjs"

export interface QueryResult<T> {
  data: { result: T } | undefined
  isLoading: boolean
  error: unknown
}

export type QueryFn<T> = (() => Promise<T>) | (() => Observable<T>) | Observable<T>

export interface QueryOptions<R = unknown> {
  enabled?: boolean
  retry?: false | number | ((attempt: number, error: unknown) => boolean)
  staleTime?: number
  cacheTime?: number
  terminateOnFirstResult?: boolean
  onError?: (error: unknown) => void
  onSuccess?: (data: R) => void
}

export type QueryStore = Map<string, Observable<any>>
