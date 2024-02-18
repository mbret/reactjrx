import { hashKey } from "./hashKey"
import { type QueryKey } from "./types"

export const compareKeys = (
  keyA: QueryKey,
  keyB: QueryKey,
  { exact = false }: { exact?: boolean } = {}
) => {
  if (exact) {
    return hashKey(keyA) === hashKey(keyB)
  }

  return partialMatchKey(keyA, keyB)
}

/**
 * Checks if key `b` partially matches with key `a`.
 */
export function partialMatchKey(a: QueryKey, b: QueryKey): boolean
export function partialMatchKey(a: any, b: any): boolean {
  if (a === b) {
    return true
  }

  if (typeof a !== typeof b) {
    return false
  }

  if (a && b && typeof a === "object" && typeof b === "object") {
    return !Object.keys(b).some((key) => !partialMatchKey(a[key], b[key]))
  }

  return false
}
