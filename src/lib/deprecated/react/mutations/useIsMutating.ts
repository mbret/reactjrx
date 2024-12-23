import { type MutationFilters } from "../../client/mutations/types"
import { type QueryClient } from "../../client/QueryClient"
import { useQueryClient } from "../useQueryClient"
import { useMutationState } from "./useMutationState"

export const useIsMutating = <TData>(
  filters: MutationFilters<TData> = {},
  queryClient?: QueryClient
) => {
  const client = useQueryClient(queryClient)

  return useMutationState(
    {
      filters: {
        ...filters,
        status: "pending"
      }
    },
    client
  ).length
}
