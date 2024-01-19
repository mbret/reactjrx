"use client"
import * as React from "react"

import { useQueryClient } from "../Provider"
import { type QueryClient } from "../../client/QueryClient"
import { type QueryFilters } from "../../client/queries/types"

export function useIsFetching(
  filters?: QueryFilters,
  queryClient?: QueryClient
): number {
  const client = useQueryClient(queryClient)
  const queryCache = client.getQueryCache()

  return React.useSyncExternalStore(
    React.useCallback(
      (onStoreChange) => {
        // return queryCache.subscribe(notifyManager.batchCalls(onStoreChange))
      },
      [queryCache]
    ),
    () => client.isFetching(filters),
    () => client.isFetching(filters)
  )
}
