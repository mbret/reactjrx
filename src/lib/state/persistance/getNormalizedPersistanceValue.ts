import { PersistanceEntry } from "./types"

export const getNormalizedPersistanceValue = (unknownValue: unknown) => {
  if (unknownValue === null) return undefined

  if (
    typeof unknownValue === "object" &&
    "__key" in unknownValue &&
    unknownValue.__key === "reactjrx_persistance"
  ) {
    return unknownValue as PersistanceEntry
  }

  return undefined
}
