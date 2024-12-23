import { hashKey } from "./hashKey"
import { partialMatchKey } from "./partialMatchKey"
import { type QueryKey } from "./types"

export const matchKey = (
  keyA: QueryKey,
  keyB: QueryKey,
  { exact = false }: { exact?: boolean } = {}
) => {
  if (exact) {
    return hashKey(keyA) === hashKey(keyB)
  }

  return partialMatchKey(keyA, keyB)
}
