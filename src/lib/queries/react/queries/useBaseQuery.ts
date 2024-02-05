"use client"

import type { UseBaseQueryOptions } from "./types"
import { useIsRestoring } from "./isRestoring"
import { useQueryClient } from "../Provider"
import { type QueryObserver } from "../../client/queries/observer/QueryObserver"
import { type QueryKey } from "../../client/keys/types"
import { type QueryClient } from "../../client/QueryClient"
import { useEffect, useMemo, useState } from "react"
import { useObserve } from "../../../binding/useObserve"
import { type QueryObserverResult } from "../../client/queries/observer/types"
import { filter, skip, skipWhile, tap } from "rxjs"
import { shallowEqual } from "../../../utils/shallowEqual"
import { useLiveRef } from "../../../utils/useLiveRef"
import { useSubscribe } from "../../../binding/useSubscribe"
import { useConstant } from "../../../utils/useConstant"

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

  /**
   * We make sure to start observing before getting optimistic updates
   * so that it starts fetching if needed
   */
  const result$ = useConstant(() => observer.observe())

  const optimisticResult = useLiveRef(
    observer.getOptimisticResult(defaultedOptions)
  )

  useObserve(
    () =>
      result$.current.result$.pipe(
        /**
         * By the time this observer runs the result may have changed (eg: synchronous setData).
         * It's important to not skip the first result (even tho most of the time they are equal).
         * We only skip if they are the same.
         */
        filter((result) => !shallowEqual(result, optimisticResult.current))
      ),
    []
  )

  useEffect(() => {
    observer.setOptions(defaultedOptions, { listeners: false })
  }, [defaultedOptions, observer])

  return optimisticResult.current
}
