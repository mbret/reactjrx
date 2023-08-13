import { type Query, type QueryOptions } from "../client/types"

export interface UseQueryOptions<R = unknown> extends QueryOptions<R> {
  refetchOnWindowFocus?:
    | boolean
    | "always"
    | ((query: Query) => boolean | "always")
  refetchOnReconnect?:
    | boolean
    | "always"
    | ((query: Query) => boolean | "always")
  refetchOnMount?: boolean | "always" | ((query: Query) => boolean | "always")
}

export interface UseQueryResult<R> {
  data: R | undefined
  isLoading: boolean
  status: "success" | "error" | "loading"
  error: unknown
  refetch: () => void
}
