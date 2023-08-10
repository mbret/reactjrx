import { useCallback, useEffect } from "react"
import {
  map,
  distinctUntilChanged,
  switchMap,
  startWith,
  filter,
  combineLatest,
  skip,
  tap,
  scan
} from "rxjs"
import { type UseQueryResult, type UseQueryOptions } from "./types"
import { useObserve } from "../../binding/useObserve"
import { useSubject } from "../../binding/useSubject"
import { useReactJrxProvider } from "./Provider"
import { useBehaviorSubject } from "../../binding/useBehaviorSubject"
import { arrayEqual } from "../../utils/arrayEqual"
import { shallowEqual } from "../../utils/shallowEqual"
import { isDefined } from "../../utils/isDefined"
import { type QueryResult, type QueryFn } from "../client/types"

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
  const internalRefresh$ = useSubject<void>()
  const { client } = useReactJrxProvider()
  const params$ = useBehaviorSubject({ queryKey, options, queryFn })

  useEffect(() => {
    params$.current.next({
      queryKey,
      options,
      queryFn
    })
  }, [queryKey, options, queryFn])

  interface ObserveResult {
    data: T | undefined
    isLoading: boolean
    fetchStatus: "fetching" | "paused" | "idle"
    status: "loading" | "error" | "success"
    error: unknown
  }

  const result = useObserve<ObserveResult>(
    () => {
      const newKeyReceived$ = params$.current.pipe(
        map(({ queryKey }) => queryKey ?? []),
        distinctUntilChanged(arrayEqual)
      )

      const newObservableObjectQuery$ = params$.current.pipe(
        map(({ queryFn }) => queryFn),
        distinctUntilChanged(shallowEqual),
        skip(1),
        filter((query) => !!query && typeof query !== "function"),
        startWith(params$.current.getValue().queryFn),
        filter(isDefined)
      )

      const fn$ = params$.current.pipe(
        map(({ queryFn }) => queryFn),
        filter(isDefined)
      )

      const options$ = params$.current.pipe(map(({ options }) => options))

      const triggers$ = combineLatest([
        newKeyReceived$,
        newObservableObjectQuery$
      ])

      return triggers$.pipe(
        tap(() => {
          // console.log("useQuery trigger")
        }),
        switchMap(([key]) => {
          const { result$ } = client.query$({
            key,
            fn$,
            options$,
            refetch$: internalRefresh$.current
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
        }),
        tap((result) => {
          console.log("useQuery", "result", result)
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
    internalRefresh$.current.next()
  }, [client])

  return { ...result, refetch }
}
