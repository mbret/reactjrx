import { type Observable } from "rxjs"

export interface QueryResult<T> {
  data: { result: T } | undefined
  isLoading: boolean
  error: unknown
}

export type QueryStore = Map<string, Observable<any>>
