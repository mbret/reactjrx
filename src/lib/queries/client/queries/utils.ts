import { compareKeys } from "../keys/compareKeys"
import { hashKey } from "../keys/serializeKey"
import { type QueryKey } from "../keys/types"
import { type Query } from "./query/Query"
import { type QueryOptions, type QueryFilters } from "./types"

export function hashQueryKeyByOptions<TQueryKey extends QueryKey = QueryKey>(
  queryKey: TQueryKey,
  options?: QueryOptions<any, any, any, TQueryKey>
): string {
  const hashFn = options?.queryKeyHashFn ?? hashKey
  return hashFn(queryKey)
}

export function matchQuery(
  filters: QueryFilters,
  query: Query<any, any, any, any>
): boolean {
  const {
    type = "all",
    exact,
    fetchStatus,
    predicate,
    queryKey,
    stale
  } = filters

  if (queryKey) {
    if (exact) {
      if (query.queryHash !== hashQueryKeyByOptions(queryKey, query.options)) {
        return false
      }
    } else if (!compareKeys(query.queryKey, queryKey, { exact: false })) {
      return false
    }
  }

  if (type !== "all") {
    const isActive = query.isActive()
    if (type === "active" && !isActive) {
      return false
    }
    if (type === "inactive" && isActive) {
      return false
    }
  }

  if (typeof stale === "boolean" && query.isStale() !== stale) {
    return false
  }

  if (
    typeof fetchStatus !== "undefined" &&
    fetchStatus !== query.state.fetchStatus
  ) {
    return false
  }

  if (predicate && !predicate(query)) {
    return false
  }

  return true
}

export function timeUntilStale(updatedAt: number, staleTime?: number): number {
  return Math.max(updatedAt + (staleTime ?? 0) - Date.now(), 0)
}
