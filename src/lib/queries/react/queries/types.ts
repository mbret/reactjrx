import { type DeprecatedQuery, type DeprecatedQueryOptions } from "../../client/types"

export interface UseQueryOptions<R = unknown> extends DeprecatedQueryOptions<R> {
  refetchOnWindowFocus?:
    | boolean
    | "always"
    | ((query: DeprecatedQuery) => boolean | "always")
  refetchOnReconnect?:
    | boolean
    | "always"
    | ((query: DeprecatedQuery) => boolean | "always")
  refetchOnMount?: boolean | "always" | ((query: DeprecatedQuery) => boolean | "always")
}

export interface UseQueryResult<R> {
  data: R | undefined
  isLoading: boolean
  status: "success" | "error" | "loading"
  error: unknown
  refetch: () => void
}
