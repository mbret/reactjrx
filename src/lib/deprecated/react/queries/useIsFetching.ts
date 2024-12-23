import { type QueryClient } from "../../client/QueryClient"
import { type QueryFilters } from "../../client/queries/types"
import { useObserve } from "../../../binding/useObserve"
import { useQueryClient } from "../useQueryClient"

export function useIsFetching(
  filters?: QueryFilters,
  queryClient?: QueryClient
): number {
  const client = useQueryClient(queryClient)
  const queryCache = client.getQueryCache()

  const result = useObserve(
    () => queryCache.observeIsFetching(filters),
    {
      defaultValue: client.isFetching(filters)
    },
    [queryCache]
  )

  return result
}
