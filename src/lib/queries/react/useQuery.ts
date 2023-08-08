import { useCallback, useEffect } from "react"
import {
  type Observable,
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
import { type QuerxOptions } from "./types"
import { useObserve } from "../../binding/useObserve"
import { useSubject } from "../../binding/useSubject"
import { useProvider } from "./Provider"
import { useBehaviorSubject } from "../../binding/useBehaviorSubject"
import { arrayEqual } from "../../utils/arrayEqual"
import { shallowEqual } from "../../utils/shallowEqual"
import { isDefined } from "../../utils/isDefined"

type Query<T> = (() => Promise<T>) | (() => Observable<T>) | Observable<T>

interface Result<R> {
  data: R | undefined
  isLoading: boolean
  error: unknown
  refetch: () => void
}

const defaultValue = { data: undefined, isLoading: true, error: undefined }

export function useQuery<T>(
  query: Query<T>,
  options?: QuerxOptions<T>
): Result<T>

export function useQuery<T>(
  key: any[],
  query: Query<T>,
  options?: QuerxOptions<T>
): Result<T>

export function useQuery<T>(
  keyOrQuery: any[] | Query<T>,
  queryOrOptionOrNothing?: Query<T> | QuerxOptions,
  optionsOrNothing?: QuerxOptions<T>
): Result<T> {
  const query = Array.isArray(keyOrQuery)
    ? (queryOrOptionOrNothing as Query<T> | undefined)
    : keyOrQuery
  const options = (optionsOrNothing ??
    (queryOrOptionOrNothing !== query ? queryOrOptionOrNothing : undefined) ??
    {}) as QuerxOptions<T>
  const internalRefresh$ = useSubject<void>()
  const { client } = useProvider()
  const key = Array.isArray(keyOrQuery) ? keyOrQuery : undefined
  const params$ = useBehaviorSubject({ key, options, query })

  useEffect(() => {
    params$.current.next({
      key,
      options,
      query
    })
  }, [key, options, query])

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
        map(({ key }) => key ?? []),
        distinctUntilChanged(arrayEqual)
      )

      const newObservableObjectQuery$ = params$.current.pipe(
        map(({ query }) => query),
        distinctUntilChanged(shallowEqual),
        skip(1),
        filter((query) => !!query && typeof query !== "function"),
        startWith(params$.current.getValue().query),
        filter(isDefined)
      )

      const fn$ = params$.current.pipe(
        map(({ query }) => query),
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
