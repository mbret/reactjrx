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

export interface MutationStateOptions<TResult> {
  filters?: MutationFilters<TResult>
  select?: (mutation: Mutation<any>) => TResult
}

export const useMutationState = <TResult = MutationState>({
  filters,
  select
}: MutationStateOptions<TResult> = {}): TResult[] => {
  const queryClient = useQueryClient()
  const filtersRef = useLiveRef(filters)
  const selectRef = useLiveRef(select)

  const { value$, lastValue } = useMemo(() => {
    const { lastValue, value$ } = queryClient.mutationClient.mutationState({
      select: (mutation) =>
        selectRef.current
          ? selectRef.current(mutation)
          : (mutation.stateSubject.getValue() as TResult)
    })

    return { lastValue, value$: value$.pipe(skip(1)) }
  }, [queryClient])

  return useObserve(value$) ?? lastValue
}
