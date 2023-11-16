import { IDENTIFIER_PERSISTANCE_KEY } from "./constants"
import { type PersistanceEntry } from "./types"

export const getNormalizedPersistanceValue = (unknownValue: unknown) => {
  if (
    typeof unknownValue === "object" &&
    unknownValue !== null &&
    IDENTIFIER_PERSISTANCE_KEY in unknownValue &&
    unknownValue[IDENTIFIER_PERSISTANCE_KEY] === IDENTIFIER_PERSISTANCE_KEY
  ) {
    return unknownValue as PersistanceEntry
  }

  return undefined
}
