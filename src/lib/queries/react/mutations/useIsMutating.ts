import { useMemo } from "react"
import { useObserve } from "../../../binding/useObserve"
import { useQueryClient } from "../Provider"
import { serializeKey } from "../../client/keys/serializeKey"
import { skip } from "rxjs"
import { type MutationFilters } from "../../client/mutations/types"
import { useLiveRef } from "../../../utils/useLiveRef"
import { type QueryClient } from "../../client/createClient"
import { createPredicateForFilters } from "../../client/mutations/filters"

export const useIsMutating = <TData>(
  filters: MutationFilters<TData> = {},
  queryClient?: QueryClient
) => {
  const defaultQueryClient = useQueryClient({ unsafe: !!queryClient })
  const finalQueryClient = queryClient?.client ?? defaultQueryClient
  const { mutationKey } = filters
  const mutationKeyRef = useLiveRef(mutationKey)
  const serializedKey = mutationKey ? serializeKey(mutationKey) : undefined
  const filtersRef = useLiveRef(filters)

  const runningMutations$ = useMemo(() => {
    const { lastValue, value$ } =
      finalQueryClient.mutationClient.isMutating<TData>({
        mutationKey: mutationKeyRef.current,
        /**
         * We have to delay function call so that we don't need a stable predicate function
         */
        predicate: (mutation) => {
          return filtersRef.current?.predicate
            ? filtersRef.current.predicate(mutation)
            : createPredicateForFilters(filtersRef.current)(mutation)
        }
      })

    return {
      lastValue,
      value$: value$.pipe(skip(1))
    }
  }, [queryClient, serializedKey])

  return useObserve(runningMutations$.value$) ?? runningMutations$.lastValue
}
