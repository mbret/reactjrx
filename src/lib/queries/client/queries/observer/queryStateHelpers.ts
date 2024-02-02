import { type Query } from "../query/Query"
import { type QueryObserverOptions } from "./types"

function isStale(
    query: Query<any, any, any, any>,
    options: QueryObserverOptions<any, any, any, any, any>,
  ): boolean {
    return query.isStaleByTime(options.staleTime)
  }
  
function shouldLoadOnMount(
  query: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any>
): boolean {
  return (
    options.enabled !== false &&
    !query.state.dataUpdatedAt &&
    !(query.state.status === "error" && options.retryOnMount === false)
  )
}

export function shouldFetchOnMount(
  query: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any, any>
): boolean {
  return (
    shouldLoadOnMount(query, options) ||
    (query.state.dataUpdatedAt > 0 &&
      shouldFetchOn(query, options, options.refetchOnMount))
  )
}

function shouldFetchOn(
  query: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any, any>,
  field: (typeof options)["refetchOnMount"] &
    (typeof options)["refetchOnWindowFocus"] &
    (typeof options)["refetchOnReconnect"]
) {
  if (options.enabled !== false) {
    const value = typeof field === "function" ? field(query) : field

    return value === "always" || (value !== false && isStale(query, options))
  }
  return false
}
