import { isPlainArray } from "../../../utils/isPlainArray"
import { isPlainObject } from "../../../utils/isPlainObject"
import { hashKey } from "../keys/hashKey"
import { partialMatchKey } from "../keys/partialMatchKey"
import { type QueryKey } from "../keys/types"
import { type Query } from "./query/Query"
import { type QueryOptions, type QueryFilters, type Updater } from "./types"

/**
 * This function returns `a` if `b` is deeply equal.
 * If not, it will replace any deeply equal children of `b` with those of `a`.
 * This can be used for structural sharing between JSON values for example.
 */
export function replaceEqualDeep<T>(a: unknown, b: T): T
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function replaceEqualDeep(a: any, b: any): any {
  if (a === b) {
    return a
  }

  const array = isPlainArray(a) && isPlainArray(b)

  if (array || (isPlainObject(a) && isPlainObject(b))) {
    const aItems = array ? a : Object.keys(a)
    const aSize = aItems.length
    const bItems = array ? b : Object.keys(b)
    const bSize = bItems.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const copy: any = array ? [] : {}

    let equalItems = 0

    for (let i = 0; i < bSize; i++) {
      const key = array ? i : bItems[i]
      if (
        !array &&
        a[key] === undefined &&
        b[key] === undefined &&
        aItems.includes(key)
      ) {
        copy[key] = undefined
        equalItems++
      } else {
        copy[key] = replaceEqualDeep(a[key], b[key])
        if (copy[key] === a[key] && a[key] !== undefined) {
          equalItems++
        }
      }
    }

    return aSize === bSize && equalItems === aSize ? a : copy
  }

  return b
}

export function hashQueryKeyByOptions<TQueryKey extends QueryKey = QueryKey>(
  queryKey: TQueryKey,
  options?: Pick<QueryOptions<any, any, any, any>, "queryKeyHashFn">
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
    } else if (!partialMatchKey(query.queryKey, queryKey)) {
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

export function functionalUpdate<TInput, TOutput>(
  updater: Updater<TInput, TOutput>,
  input: TInput
): TOutput {
  return typeof updater === "function"
    ? (updater as (_: TInput) => TOutput)(input)
    : updater
}

export function replaceData<
  TData,
  TOptions extends QueryOptions<any, any, any, any>
>(prevData: TData | undefined, data: TData, options: TOptions): TData {
  if (typeof options.structuralSharing === "function") {
    return options.structuralSharing(prevData, data) as TData
  } else if (options.structuralSharing !== false) {
    // Structurally share data between prev and new data if needed
    return replaceEqualDeep(prevData, data)
  }
  return data
}

// eslint-disable-next-line symbol-description
export const skipToken = Symbol()
export type SkipToken = typeof skipToken
