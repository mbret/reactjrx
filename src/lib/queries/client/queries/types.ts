import { type QueryKey } from "../keys/types"
import { type Query } from "./Query"

export type QueryStatus = "pending" | "error" | "success"
export type FetchStatus = "fetching" | "paused" | "idle"

export type QueryTypeFilter = "all" | "active" | "inactive"

export interface QueryFilters {
  /**
   * Filter to active queries, inactive queries or all queries
   */
  type?: QueryTypeFilter
  /**
   * Match query key exactly
   */
  exact?: boolean
  /**
   * Include queries matching this predicate function
   */
  predicate?: (query: Query) => boolean
  /**
   * Include queries matching this query key
   */
  queryKey?: QueryKey
  /**
   * Include or exclude stale queries
   */
  stale?: boolean
  /**
   * Include queries matching their fetchStatus
   */
  fetchStatus?: FetchStatus
}
