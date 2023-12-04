import { useMemo } from "react"
import { useObserve } from "../../../binding/useObserve"
import { useQueryClient } from "../Provider"
import {
  type MutationState,
  type MutationFilters
} from "../../client/mutations/types"
import { useLiveRef } from "../../../utils/useLiveRef"
import { type Mutation } from "../../client/mutations/Mutation"
import { skip } from "rxjs"
import { serializeKey } from "../../client/keys/serializeKey"
import { createPredicateForFilters } from "../../client/mutations/filters"

export interface MutationStateOptions<TResult, TData> {
  filters?: MutationFilters<TData>
  select?: (mutation: Mutation<any>) => TResult
}

export const useMutationState = <TData, TResult = MutationState>({
  filters,
  select
}: MutationStateOptions<TResult, TData> = {}): TResult[] => {
  const queryClient = useQueryClient()
  const { mutationKey, status } = filters ?? {}
  const filtersRef = useLiveRef(filters)
  const serializedKey = mutationKey ? serializeKey(mutationKey) : undefined
  const selectRef = useLiveRef(select)

  const { value$, lastValue } = useMemo(() => {
    const { lastValue, value$ } = queryClient.mutationClient.mutationState<
      TData,
      TResult
    >({
      filters: {
        predicate: (mutation) => {
          return filtersRef.current?.predicate
            ? filtersRef.current.predicate(mutation)
            : createPredicateForFilters(filtersRef.current)(mutation)
        }
      },
      select: (mutation) =>
        selectRef.current
          ? selectRef.current(mutation)
          : (mutation.state as TResult)
    })

    return { lastValue, value$: value$.pipe(skip(1)) }
  }, [queryClient, serializedKey, status])

  return useObserve(value$) ?? lastValue
}
