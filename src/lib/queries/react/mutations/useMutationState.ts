import { useMemo } from "react"
import { useObserve } from "../../../binding/useObserve"
import { useQueryClient } from "../Provider"
import { serializeKey } from "../../client/keys/serializeKey"
import { skip } from "rxjs"
import { type MutationFilters } from "../../client/mutations/types"
import { useLiveRef } from "../../../utils/useLiveRef"
import { type QueryClient } from "../../client/createClient"

export const useIsMutating = (
  { mutationKey, predicate }: MutationFilters = {},
  queryClient?: QueryClient
) => {
  const defaultQueryClient = useQueryClient({ unsafe: !!queryClient })
  const finalQueryClient = queryClient?.client ?? defaultQueryClient
  const mutationKeyRef = useLiveRef(mutationKey)
  const serializedKey = mutationKey ? serializeKey(mutationKey) : undefined
  const predicateRef = useLiveRef(predicate)

  const runningMutations$ = useMemo(() => {
    const { lastValue, value$ } =
      finalQueryClient.mutationClient.runningMutations({
        mutationKey: mutationKeyRef.current,
        /**
         * We have to delay function call so that we don't need a stable predicate function
         */
        predicate: (mutation) =>
          !predicateRef.current
            ? mutationKeyRef.current
              ? // @todo optimize
                serializeKey(mutationKeyRef.current) ===
                serializeKey(mutation.options.mutationKey)
              : true
            : predicateRef.current(mutation)
      })

    return {
      lastValue,
      value$: value$.pipe(skip(1))
    }
  }, [queryClient, serializedKey])

  return useObserve(runningMutations$.value$) ?? runningMutations$.lastValue
}
