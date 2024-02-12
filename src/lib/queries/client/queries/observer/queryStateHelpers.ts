import { onlineManager } from "../../onlineManager"
import { type Query } from "../query/Query"
import { type NetworkMode } from "../types"
import { type QueryObserverOptions } from "./types"

export function isStale(
  query: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any, any>
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

export function shouldFetchOptionally(
  query: Query<any, any, any, any>,
  prevQuery: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any, any>,
  prevOptions: QueryObserverOptions<any, any, any, any, any>
): boolean {
  return (
    query.state.fetchStatus !== "fetching" &&
    options.enabled !== false &&
    (query !== prevQuery || prevOptions.enabled === false) &&
    (!options.suspense || query.state.status !== "error") &&
    isStale(query, options)
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

export function canFetch(networkMode: NetworkMode | undefined): boolean {
  return (networkMode ?? "online") === "online"
    ? onlineManager.isOnline()
    : true
}
