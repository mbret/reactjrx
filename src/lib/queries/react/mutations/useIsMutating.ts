import { type MutationFilters } from "../../client/mutations/types"
import { type QueryClient } from "../../client/createClient"
import { useMutationState } from "./useMutationState"

export const useIsMutating = <TData>(
  filters: MutationFilters<TData> = {},
  queryClient?: QueryClient
) => {
  return useMutationState(
    {
      filters: {
        ...filters,
        status: "pending"
      }
    },
    queryClient
  ).length
}
