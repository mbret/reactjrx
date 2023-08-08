import { useCallback, useEffect } from "react"
import {
  map,
  finalize,
  distinctUntilChanged,
  switchMap,
  pairwise,
  startWith,
  filter,
  combineLatest,
  skip,
  identity
} from "rxjs"
import { type UseQueryResult, type UseQueryOptions } from "./types"
import { useObserve } from "../../binding/useObserve"
import { useSubject } from "../../binding/useSubject"
import { useProvider } from "./Provider"
import { useBehaviorSubject } from "../../binding/useBehaviorSubject"
import { arrayEqual } from "../../utils/arrayEqual"
import { shallowEqual } from "../../utils/shallowEqual"
import { isDefined } from "../../utils/isDefined"
import { type QueryFn } from "../client/types"

const defaultValue = { data: undefined, isLoading: true, error: undefined }

export function useQuery<T>({
  queryKey,
  queryFn,
  ...options
}: {
  queryKey?: any[]
  queryFn?: QueryFn<T>
} & UseQueryOptions<T>): UseQueryResult<T> {
  const internalRefresh$ = useSubject<void>()
  const { client } = useProvider()
  const params$ = useBehaviorSubject({ queryKey, options, queryFn })

  useEffect(() => {
    params$.current.next({
      queryKey,
      options,
      queryFn
    })
  }, [queryKey, options, queryFn])

  const result = useObserve<{
    data: T | undefined
    isLoading: boolean
    error: unknown
  }>(
    () => {
      const computedDefaultValue = {
        ...defaultValue,
        isLoading: params$.current.getValue().options.enabled !== false
      }

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
        switchMap(([key]) => {
          const { query$, refetch$ } = client.query$({
            key,
            fn$,
            options$
          })

          const subscriptions = [internalRefresh$.current.subscribe(refetch$)]

          return query$.pipe(
            finalize(() => {
              subscriptions.forEach((sub) => {
                sub.unsubscribe()
              })
            }),
            startWith(computedDefaultValue),
            pairwise(),
            map(
              ([
                { data: previousData, ...restPrevious },
                { data: currentData, ...restCurrent }
              ]) => ({
                ...restPrevious,
                ...restCurrent,
                data:
                  currentData && "result" in currentData
                    ? currentData.result
                    : previousData?.result
              })
            )
          )
        }),
        /**
         * @important
         * We skip the first result as it is comparable to default passed value.
         * This is assuming all query are async and does not return a result right away.
         * This is a design choice.
         */
        params$.current.getValue().options.enabled !== false
          ? skip(1)
          : identity
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
