import { serializeKey, serializeObject } from "./serializeKey"
import { type QueryKey } from "./types"

export const compareKeys = (
  keyA: QueryKey,
  keyB: QueryKey,
  { exact = false }: { exact?: boolean } = {}
) => {
  if (exact) {
    return serializeKey(keyA) === serializeKey(keyB)
  }

  return keyA.reduce((acc: boolean, value, index) => {
    if (!acc) return false

    if (value === undefined) {
      const hasNextItemInLineNotUndefined = keyA
        .slice(index, keyA.length - 1)
        .some((item) => item !== undefined)
      if (!hasNextItemInLineNotUndefined) {
        return true
      }
    }

    return serializeObject(value) === serializeObject(keyB[index])
  }, true)
}
