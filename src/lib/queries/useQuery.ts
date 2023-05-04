import { useCallback, useEffect } from "react"
import {
  type Observable,
  catchError,
  combineLatest,
  defer,
  distinctUntilChanged,
  filter,
  from,
  map,
  of,
  share,
  startWith,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom
} from "rxjs"
import { arrayEqual } from "../utils/arrayEqual"
import { shallowEqual } from "../utils/shallowEqual"
import { querx } from "./querx"
import { type QuerxOptions } from "./types"
import { useBehaviorSubject } from "../binding/useBehaviorSubject"
import { useSubscribe } from "../binding/useSubscribe"
import { useObserve } from "../binding/useObserve"
// import { useCacheOperator } from "./useCacheOperator"
import { useSubject } from "../binding/useSubject"
import { useProvider } from "./Provider"
import { serializeKey } from "./serializeKey"
import { deduplicate } from "./deduplication/deduplicate"
import { autoRefetch } from "./invalidation/autoRefetch"

type Query<T> = (() => Promise<T>) | (() => Observable<T>) | Observable<T>

interface Result<R> {
  data: R | undefined
  isLoading: boolean
  error: unknown
  refetch: () => void
}

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
  const key = Array.isArray(keyOrQuery) ? keyOrQuery : undefined
  const params$ = useBehaviorSubject({ key, options, query })
  const refetch$ = useSubject<void>()
  const data$ = useBehaviorSubject<{
    data: T | undefined
    isLoading: boolean
    error: unknown
  }>({
    data: undefined,
    error: undefined,
    isLoading: true
  })
  const { queryStore } = useProvider()
  // const withCache = useCacheOperator()

  useEffect(() => {
    params$.current.next({
      key,
      options,
      query
    })
  }, [key, options, query])

  useSubscribe(() => {
    const options$ = params$.current.pipe(
      map(({ options }) => options),
      distinctUntilChanged(shallowEqual)
    )

    const newKeyReceived$ = params$.current.pipe(
      map(({ key }) => key ?? []),
      distinctUntilChanged(arrayEqual)
    )

    const newQuery$ = params$.current.pipe(
      map(({ query }) => query ?? (() => of(undefined)))
    )

    const queryAsObservableObjectChanged$ = newQuery$.pipe(
      filter((query) => typeof query !== "function"),
      distinctUntilChanged(shallowEqual)
    )

    const enabledOptionChanged$ = options$.pipe(
      map(({ enabled = true }) => enabled),
      distinctUntilChanged(),
      share()
    )

    const queryTrigger$ = combineLatest([
      newKeyReceived$,
      enabledOptionChanged$,
      queryAsObservableObjectChanged$.pipe(startWith(undefined)),
      refetch$.current.pipe(startWith(undefined))
    ])

    const disabled$ = enabledOptionChanged$.pipe(
      filter((enabled) => !enabled),
      tap(() => {
        // we know that any ongoing promise will be cancelled
        // so we can safely stop loading. We don't do it in finalize
        // because it would conflict with concurrency
        data$.current.next({
          ...data$.current.getValue(),
          isLoading: false
        })
      })
    )

    return queryTrigger$.pipe(
      withLatestFrom(options$, newQuery$),
      map(([[key, enabled], options, query]) => ({
        key,
        enabled,
        options,
        query
      })),
      filter(({ enabled }) => enabled),

      switchMap(({ key, options, query }) => {
        const serializedKey = serializeKey(key)

        return of(null).pipe(
          tap(() => {
            data$.current.next({
              ...data$.current.getValue(),
              error: undefined,
              isLoading: true
            })
          }),
          switchMap(() => {
            const query$ = defer(() => {
              const queryOrResponse =
                typeof query === "function" ? query() : query

              return from(queryOrResponse)
            })

            return query$.pipe(
              querx(options),
              deduplicate(serializedKey, queryStore),
              // key.length > 0 ? withCache(key) : identity,
              map((response) => [response] as const),
              catchError((error) => {
                return of([undefined, error] as const)
              }),
              tap(([response, error]) => {
                if (response) {
                  if (options.onSuccess != null) options.onSuccess(response)
                }

                data$.current.next({
                  ...data$.current.getValue(),
                  isLoading: false,
                  error,
                  data: response
                })
              })
            )
          }),
          autoRefetch(options),
          takeUntil(disabled$)
        )
      })
    )
  }, [])

  const result = useObserve(
    () => data$.current,
    { defaultValue: data$.current.getValue() },
    []
  )

  const refetch = useCallback((arg: void) => {
    refetch$.current.next(arg)
  }, [])

  return { ...result, refetch }
}
