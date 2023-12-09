import { compareKeys } from "../keys/compareKeys"
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
  predicate,
  exact = true
}: MutationFilters<TData, TError, TVariables, TContext> = {}) => {
  const defaultPredicate: MutationFilters<
    TData,
    TError,
    TVariables,
    TContext
  >["predicate"] = (mutation) => {
    if (
      exact &&
      mutationKey !== undefined &&
      !compareKeys(mutation.options.mutationKey, mutationKey, { exact })
    ) {
      return false
    }

    if (
      !exact &&
      mutationKey !== undefined &&
      !compareKeys(mutationKey, mutation.options.mutationKey, { exact })
    ) {
      return false
    }

    if (status && mutation.state.status !== status) return false

    return true
  }
  const finalPredicate = predicate ?? defaultPredicate

  return finalPredicate
}
