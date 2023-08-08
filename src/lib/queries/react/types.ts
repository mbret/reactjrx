import { type QueryOptions } from "../client/types"

export interface UseQueryOptions<R = unknown> extends QueryOptions<R> {
  // @todo
  refetchOnWindowFocus?: boolean
  // @todo
  refetchOnMount?: boolean
}

export interface UseQueryResult<R> {
  data: R | undefined
  isLoading: boolean
  error: unknown
  refetch: () => void
}
