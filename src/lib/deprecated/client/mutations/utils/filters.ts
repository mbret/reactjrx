import { matchKey } from "../../keys/matchKey"
import { type DefaultError } from "../../types"
import { type MutationFilters } from "../types"

export const createPredicateForFilters = <
  TData = unknown,
  TError = DefaultError,
  TVariables = any,
  TContext = unknown
>({
  mutationKey,
  status,
  predicate,
  exact = true
}: MutationFilters<TData, TError, TVariables, TContext> = {}) => {
  const finalPredicate: MutationFilters<
    TData,
    TError,
    TVariables,
    TContext
  >["predicate"] = (mutation) => {
    if (
      exact &&
      mutationKey !== undefined &&
      mutation.options.mutationKey !== undefined &&
      !matchKey(mutation.options.mutationKey, mutationKey, { exact })
    ) {
      return false
    }

    if (
      !exact &&
      mutationKey !== undefined &&
      mutation.options.mutationKey !== undefined &&
      !matchKey(mutation.options.mutationKey, mutationKey, { exact })
    ) {
      return false
    }

    if (status && mutation.state.status !== status) return false

    if (predicate) {
      return predicate(mutation)
    }

    return true
  }

  return finalPredicate
}
