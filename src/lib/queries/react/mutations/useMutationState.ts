import { useMemo } from "react"
import { useObserve } from "../../../binding/useObserve"
import { type MutationFilters } from "../../client/mutations/types"
import { useLiveRef } from "../../../utils/useLiveRef"
import { type Mutation } from "../../client/mutations/mutation/Mutation"
import { skip } from "rxjs"
import { hashKey } from "../../client/keys/hashKey"
import { createPredicateForFilters } from "../../client/mutations/filters"
import { type QueryClient } from "../../client/QueryClient"
import { type MutationState } from "../../client/mutations/mutation/types"
import { useQueryClient } from "../useQueryClient"

export interface MutationStateOptions<TResult, TData> {
  filters?: MutationFilters<TData>
  select?: (mutation: Mutation<any>) => TResult
}

export const useMutationState = <TData, TResult = MutationState>(
  { filters, select }: MutationStateOptions<TResult, TData> = {},
  queryClient?: QueryClient
): TResult[] => {
  const finalQueryClient = useQueryClient(queryClient)
  const { mutationKey, status } = filters ?? {}
  const filtersRef = useLiveRef(filters)
  const serializedKey = mutationKey ? hashKey(mutationKey) : undefined
  const selectRef = useLiveRef(select)

  const { value$, lastValue } = useMemo(() => {
    void serializedKey
    void status

    const { lastValue, value$ } = finalQueryClient
      .getMutationCache()
      .observe<TData, TResult>({
        filters: {
          ...filtersRef.current,
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
  }, [finalQueryClient, serializedKey, status, filtersRef, selectRef])

  return useObserve(value$) ?? lastValue
}
