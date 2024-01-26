"use client"

import type { UseBaseQueryOptions } from "./types"
import { useIsRestoring } from "./isRestoring"
import { useQueryClient } from "../Provider"
import { type QueryObserver } from "../../client/queries/observer/QueryObserver"
import { type QueryKey } from "../../client/keys/types"
import { type QueryClient } from "../../client/QueryClient"
import { type QueryObserverResult } from "../../client/queries/types"
import { useEffect, useState } from "react"
import { useObserve } from "../../../binding/useObserve"

export function useBaseQuery<
  TQueryFnData,
  TError,
  TData,
  TQueryData,
  TQueryKey extends QueryKey
>(
  options: UseBaseQueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
  Observer: typeof QueryObserver,
  queryClient?: QueryClient
): QueryObserverResult<TData, TError> {
  const client = useQueryClient(queryClient)
  const isRestoring = useIsRestoring()
  const defaultedOptions = client.defaultQueryOptions(options)

  // Make sure results are optimistically set in fetching state before subscribing or updating options
  defaultedOptions._optimisticResults = isRestoring
    ? "isRestoring"
    : "optimistic"

  const [observer] = useState(
    () =>
      new Observer<TQueryFnData, TError, TData, TQueryData, TQueryKey>(
        client,
        defaultedOptions
      )
  )

  const result = useObserve(
    () => observer.observe(),
    { defaultValue: observer.getCurrentResult() },
    []
  )

  useEffect(() => {
    observer.setOptions(defaultedOptions, { listeners: false })
  }, [defaultedOptions, observer])

  return result
}
