import type { UseBaseQueryOptions } from "./types"
import { useIsRestoring } from "./isRestoring"
import { type QueryObserver } from "../../client/queries/observer/QueryObserver"
import { type QueryKey } from "../../client/keys/types"
import { type QueryClient } from "../../client/QueryClient"
import { useEffect, useState } from "react"
import { useObserve } from "../../../binding/useObserve"
import { type QueryObserverResult } from "../../client/queries/observer/types"
import { filter, tap } from "rxjs"
import { shallowEqual } from "../../../utils/shallowEqual"
import { useLiveRef } from "../../../utils/useLiveRef"
import { useConstant } from "../../../utils/useConstant"
import { useQueryClient } from "../useQueryClient"
import { useQueryErrorResetBoundary } from "./QueryErrorResetBoundary"
import { getHasError } from "./errorBoundaryUtils"

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
  /**
   * Needed to pass react query tests
   */
  if (process.env.NODE_ENV !== "production") {
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new Error(
        'Bad argument type. Starting with v5, only the "Object" form is allowed when calling query related functions. Please use the error stack to find the culprit call. More info here: https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5#supports-a-single-signature-one-object'
      )
    }
  }

  const client = useQueryClient(queryClient)
  const isRestoring = useIsRestoring()
  const errorResetBoundary = useQueryErrorResetBoundary()
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

  const result = optimisticResult.current

  useObserve(
    () =>
      result$.current.pipe(
        /**
         * By the time this observer runs the result may have changed (eg: synchronous setData).
         * It's important to not skip the first result (even tho most of the time they are equal).
         * We only skip if they are the same.
         */
        filter((result) => !shallowEqual(result, optimisticResult.current)),
        tap(() => {
          console.log("RE_RENDER")
        })
      ),
    []
  )

  useEffect(() => {
    observer.setOptions(defaultedOptions)
  }, [defaultedOptions, observer])

  // Handle error boundary
  const error = result.error

  if (
    error &&
    getHasError({
      result,
      errorResetBoundary,
      throwOnError: defaultedOptions.throwOnError,
      query: client
        .getQueryCache()
        .get<TQueryFnData, TError, TQueryData, TQueryKey>(
          defaultedOptions.queryHash
        )
    })
  ) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw error
  }

  return optimisticResult.current
}
