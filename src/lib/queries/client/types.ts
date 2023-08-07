export interface QueryResult<T> {
  data: { result: T } | undefined
  isLoading: boolean
  error: unknown
}
