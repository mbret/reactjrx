import { serializeKey } from "../keys/serializeKey"
import { type MutationFilters } from "./types"

export const createPredicateForFilters = <TData>({
  mutationKey,
  predicate
}: MutationFilters<TData> = {}) => {
  const defaultPredicate: MutationFilters<TData>["predicate"] = ({
    options
  }) =>
    mutationKey
      ? // @todo optimize
        serializeKey(options.mutationKey) === serializeKey(mutationKey)
      : true
  const finalPredicate = predicate ?? defaultPredicate

  return finalPredicate
}
