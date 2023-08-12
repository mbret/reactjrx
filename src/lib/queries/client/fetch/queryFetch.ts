import {
  type Observable,
  catchError,
  defer,
  distinctUntilChanged,
  filter,
  from,
  map,
  merge,
  of,
  take,
  takeUntil,
  tap,
  last,
  share
} from "rxjs"
import {
  type QueryResult,
  type QueryFn,
  type QueryOptions,
  type QueryTrigger
} from "../types"
import { deduplicate } from "../deduplication/deduplicate"
import { retryQueryOnFailure } from "../retryQueryOnFailure"
import { type createQueryStore } from "../store/createQueryStore"
import { notifyQueryResult } from "./notifyQueryResult"

export const createQueryFetch = <T>({
  options$,
  options,
  fn,
  queryStore,
  serializedKey,
  trigger
}: {
  fn: QueryFn<T>
  options$: Observable<QueryOptions<T>>
  options: QueryOptions<T>
  queryStore: ReturnType<typeof createQueryStore>
  serializedKey: string
  trigger: QueryTrigger
}) => {
  const enabledOption$ = options$.pipe(
    map(({ enabled = true }) => enabled),
    distinctUntilChanged()
  )

  const disabled$ = enabledOption$.pipe(
    distinctUntilChanged(),
    filter((enabled) => !enabled)
  )

  const deferredQuery = defer(() => {
    const queryOrResponse = typeof fn === "function" ? fn() : fn

    return from(queryOrResponse)
  })

  const fnExecution$ = deferredQuery.pipe(
    retryQueryOnFailure(options),
    deduplicate(serializedKey, queryStore),
    tap((result) => {
      queryStore.dispatchQueryEvent({
        key: serializedKey,
        type: "fetchSuccess"
      })
      queryStore.update(serializedKey, {
        lastFetchedAt: new Date().getTime(),
        ...(options.cacheTime !== 0 && {
          queryCacheResult: { result }
        })
      })
    }),
    map((result) => ({
      status: "success" as const,
      data: { result },
      error: undefined
    })),
    catchError((error) => {
      queryStore.dispatchQueryEvent({
        key: serializedKey,
        type: "fetchError"
      })

      return of({
        fetchStatus: "idle" as const,
        status: "error" as const,
        data: undefined,
        error
      })
    }),
    notifyQueryResult(options$),
    share()
  )

  /**
   * Make sure to dispatch idle only on the end of even long living
   * observable. long living observable will stay in `fetching` state
   * as long as they don't complete.
   */
  const fnExecutionEnd$ = fnExecution$.pipe(
    last(),
    map(() => ({
      fetchStatus: "idle" as const
    })),
    catchError((error) => {
      return of({
        fetchStatus: "idle" as const,
        status: "error" as const,
        data: undefined,
        error
      })
    })
  )

  const execution$: Observable<Partial<QueryResult<T>>> = merge(
    disabled$.pipe(
      take(1),
      map(() => ({
        fetchStatus: "idle" as const
      }))
    ),
    merge(
      of({ fetchStatus: "fetching" as const, error: undefined }),
      fnExecution$,
      fnExecutionEnd$
    ).pipe(takeUntil(disabled$))
  )

  const query = queryStore.get(serializedKey)

  const cacheResult = query?.queryCacheResult as undefined | { result: T }

  const hasCache = !!cacheResult

  // bypass fetch completely
  if (hasCache) {
    if (!query?.isStale && !trigger.ignoreStale) {
      return of({
        fetchStatus: "idle" as const,
        status: "success" as const,
        data: { result: cacheResult.result },
        error: undefined
      })
    } else {
      return merge(
        of({
          fetchStatus: "idle" as const,
          status: "success" as const,
          data: { result: cacheResult.result },
          error: undefined
        }),
        execution$
      )
    }
  }

  return execution$
}
