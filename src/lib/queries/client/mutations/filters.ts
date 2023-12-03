import { serializeKey } from "../keys/serializeKey"
import { type MutationFilters } from "./types"

export const createPredicateForFilters = <TData>({
  mutationKey,
  status,
  predicate
}: MutationFilters<TData> = {}) => {
  const defaultPredicate: MutationFilters<TData>["predicate"] = (mutation) => {
    if (
      mutationKey !== undefined &&
      // @todo optimize
      serializeKey(mutation.options.mutationKey) !== serializeKey(mutationKey)
    ) {
      return false
    }

    if (status && mutation.stateSubject.getValue().status !== status)
      return false

    return true
  }
  const finalPredicate = predicate ?? defaultPredicate

  return finalPredicate
}
