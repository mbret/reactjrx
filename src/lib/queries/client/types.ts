import { type Observable } from "rxjs"

export interface QueryResult<T> {
  data: { result: T } | undefined
  isLoading: boolean
  error: unknown
}

export interface QueryOptions<R = unknown> {
  enabled?: boolean
  retry?: false | number | ((attempt: number, error: unknown) => boolean)
  staleTime?: number
  cacheTime?: number
  onError?: (error: unknown) => void
  onSuccess?: (data: R) => void
}

export type QueryStore = Map<string, Observable<any>>
