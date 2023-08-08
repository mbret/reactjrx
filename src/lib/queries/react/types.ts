import { type QueryOptions } from "../client/types"

export interface QuerxOptions<R = unknown> extends QueryOptions<R> {
  // @todo
  refetchOnWindowFocus?: boolean
  // @todo
  refetchOnMount?: boolean
}
