import { useCallback } from "react"
import {
  map,
  distinctUntilChanged,
  switchMap,
  filter,
  skip,
  scan,
  merge,
  withLatestFrom,
  of,
  identity,
  throttleTime
} from "rxjs"
import { type UseQueryResult, type UseQueryOptions } from "./types"
import { useObserve } from "../../../binding/useObserve"
import { useSubject } from "../../../binding/useSubject"
import { useQueryClient } from "../Provider"
import { arrayEqual } from "../../../utils/arrayEqual"
import { shallowEqual } from "../../../utils/shallowEqual"
import { isDefined } from "../../../utils/isDefined"
import {
  type QueryResult,
  type QueryFn,
  type QueryTrigger
} from "../../client/types"
import { createActivityTrigger } from "../triggers/activityTrigger"
import { createNetworkTrigger } from "../triggers/networkTrigger"
import { useQueryParams } from "./helpers"

const defaultValue = {
  data: undefined,
  isLoading: true,
  error: undefined,
  status: "loading" as const,
  fetchStatus: "idle" as const
}

export function useQuery<T>({
  queryKey,
  queryFn,
  ...options
}: {
  queryKey?: any[]
  queryFn?: QueryFn<T>
} & UseQueryOptions<T>): UseQueryResult<T> {
  const internalRefresh$ = useSubject<QueryTrigger>()
  const client = useQueryClient()
  const params$ = useQueryParams({ queryFn, queryKey, ...options })

  interface ObserveResult {
    data: T | undefined
    isLoading: boolean
    fetchStatus: "fetching" | "paused" | "idle"
    status: "loading" | "error" | "success"
    error: unknown
  }

  const result = useObserve<ObserveResult>(
    () => {
      const key$ = params$.current.pipe(map(({ queryKey }) => queryKey ?? []))

      const initialTrigger$ = of(null)

      const newKeyTrigger$ = key$.pipe(
        distinctUntilChanged(arrayEqual),
        skip(1)
      )

      const isQueryObject = (query: unknown) =>
        !!query && typeof query !== "function"

      const newObservableObjectQuery$ = params$.current.pipe(
        map(({ queryFn }) => queryFn),
        filter(isQueryObject),
        distinctUntilChanged(shallowEqual),
        isQueryObject(params$.current.getValue().queryFn) ? skip(1) : identity
      )

      const fn$ = params$.current.pipe(
        map(({ queryFn }) => queryFn),
        filter(isDefined)
      )

      const options$ = params$.current.pipe(map(({ options }) => options))

      const activityRefetch$ = createActivityTrigger(params$.current)
      const networkRefetch$ = createNetworkTrigger(params$.current)

      const newQueryTrigger$ = merge(
        initialTrigger$,
        newKeyTrigger$,
        newObservableObjectQuery$
      )

      const trigger$ = merge(
        internalRefresh$.current,
        merge(activityRefetch$, networkRefetch$).pipe(throttleTime(500))
      )

      return newQueryTrigger$.pipe(
        withLatestFrom(key$),
        switchMap(([, key]) => {
          const { result$ } = client.client.query({
            key,
            fn$,
            options$,
            trigger$
          })

          return result$.pipe(
            scan<QueryResult<T>, ObserveResult, Partial<ObserveResult>>(
              (previousValue, { data: currentData, ...currentValue }) => ({
                data: undefined,
                ...previousValue,
                ...currentValue,
                isLoading: currentValue.status === "loading",
                ...(currentData && {
                  data: currentData.result
                })
              }),
              {}
            )
          )
        })
        /**
         * @important
         * We skip the first result as it is comparable to default passed value.
         * This is assuming all query are async and does not return a result right away.
         * This is a design choice.
         */
        // params$.current.getValue().options.enabled !== false
        //   ? skip(1)
        //   : identity
      )
    },
    {
      defaultValue: {
        ...defaultValue,
        isLoading: params$.current.getValue().options.enabled !== false
      }
    },
    [client]
  )

  const refetch = useCallback(() => {
    internalRefresh$.current.next({ type: "refetch", ignoreStale: true })
  }, [client])

  return { ...result, refetch }
}
