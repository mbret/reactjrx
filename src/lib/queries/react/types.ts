import { type Query, type QueryOptions } from "../client/types"

export interface UseQueryOptions<R = unknown> extends QueryOptions<R> {
  refetchOnWindowFocus?: boolean | "always" | ((query: Query) => boolean | "always")
  refetchOnReconnect?: boolean | "always" | ((query: Query) => boolean | "always")
  // @todo
  refetchOnMount?: boolean
}

export interface UseQueryResult<R> {
  data: R | undefined
  isLoading: boolean
  error: unknown
  refetch: () => void
}
