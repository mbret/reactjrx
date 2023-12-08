import { serializeKey } from "../keys/serializeKey"
import { type DefaultError } from "../types"
import { type MutationFilters } from "./types"

export const createPredicateForFilters = <
  TData = unknown,
  TError = DefaultError,
  TVariables = any,
  TContext = unknown
>({
  mutationKey,
  status,
  predicate
}: MutationFilters<TData, TError, TVariables, TContext> = {}) => {
  const defaultPredicate: MutationFilters<
    TData,
    TError,
    TVariables,
    TContext
  >["predicate"] = (mutation) => {
    if (
      mutationKey !== undefined &&
      // @todo optimize
      serializeKey(mutation.options.mutationKey) !== serializeKey(mutationKey)
    ) {
      return false
    }

    if (status && mutation.state.status !== status) return false

    return true
  }
  const finalPredicate = predicate ?? defaultPredicate

  return finalPredicate
}
