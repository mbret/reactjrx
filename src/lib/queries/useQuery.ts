import { useCallback, useEffect } from "react"
import {
  Observable,
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
import { useObserve } from "../useObserve"
import { querx } from "./querx"
import { QuerxOptions } from "./types"
import { useBehaviorSubject } from "../useBehaviorSubject"
import { useSubject } from "../useSubject"
import { useSubscribe } from "../useSubscribe"

type Query<T> = (() => Promise<T>) | (() => Observable<T>) | Observable<T>

type Result<R> = {
  data: R | undefined
  isLoading: boolean
  error: unknown
  refetch: () => void
}

export function useQuery<T>(query: Query<T>, options?: QuerxOptions): Result<T>

export function useQuery<T>(
  key: any[],
  query: Query<T>,
  options?: QuerxOptions
): Result<T>

export function useQuery<T>(
  keyOrQuery: any[] | Query<T>,
  queryOrOptionOrNothing?: Query<T> | QuerxOptions,
  optionsOrNothing?: QuerxOptions
): Result<T> {
  const query = Array.isArray(keyOrQuery)
    ? (queryOrOptionOrNothing as Query<T> | undefined)
    : keyOrQuery
  const options = (optionsOrNothing ??
    (queryOrOptionOrNothing !== query ? queryOrOptionOrNothing : undefined) ??
    {}) as QuerxOptions
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

    const query$ = params$.current.pipe(
      map(({ query }) => query ?? (() => of(undefined)))
    )

    const queryAsObservableObjectChanged$ = query$.pipe(
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
      filter(([, enabled]) => enabled),
      withLatestFrom(options$, query$),
      tap(() => {
        data$.current.next({
          ...data$.current.getValue(),
          error: undefined,
          isLoading: true
        })
      }),
      switchMap(([, options, query]) =>
        from(defer(() => (typeof query === "function" ? query() : query))).pipe(
          querx(options),
          map((response) => [response] as const),
          catchError((error) => {
            return of([undefined, error] as const)
          }),
          takeUntil(disabled$)
        )
      ),
      tap(([response, error]) => {
        data$.current.next({
          ...data$.current.getValue(),
          isLoading: false,
          error,
          data: response
        })
      })
    )
  }, [])

  const result = useObserve(data$.current, {
    defaultValue: data$.current.getValue()
  })

  const refetch = useCallback(() => refetch$.current.next(undefined), [])

  return { ...result, refetch }
}
