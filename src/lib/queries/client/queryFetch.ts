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
  iif,
  last,
  share,
} from "rxjs"
import { type QueryFn, type QueryOptions } from "./types"
import { deduplicate } from "./deduplication/deduplicate"
import { retryQueryOnFailure } from "./retryQueryOnFailure"
import { notifyQueryResult } from "./operators"
import { type createQueryStore } from "./createQueryStore"
import { type createDeduplicationStore } from "./deduplication/createDeduplicationStore"

export const createQueryFetch = <T>({
  options$,
  options,
  fn,
  queryStore,
  serializedKey,
  deduplicationStore
}: {
  fn: QueryFn<T>
  options$: Observable<QueryOptions<T>>
  options: QueryOptions<T>
  queryStore: ReturnType<typeof createQueryStore>
  serializedKey: string
  deduplicationStore: ReturnType<typeof createDeduplicationStore>
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
    deduplicate(serializedKey, deduplicationStore),
    retryQueryOnFailure(options),
    tap((result) => {
      // console.log("reactjrx", "query", serializedKey, "fetch", "result", result)

      if (options.cacheTime !== 0) {
        queryStore.update(serializedKey, {
          queryCacheResult: { result }
        })
      }
    }),
    map((result) => ({
      status: "success" as const,
      data: { result },
      error: undefined
    })),
    catchError((error) =>
      of({
        fetchStatus: "idle" as const,
        status: "error" as const,
        data: undefined,
        error
      })
    ),
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

  const execution$ = merge(
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
    ).pipe(
      // autoRefetch(options$),
      takeUntil(disabled$)
    )
  )

  const cacheResult = queryStore.get(serializedKey)?.queryCacheResult as
    | undefined
    | { result: T }

  return iif(
    () => {
      const hasCache = !!cacheResult

      if (hasCache) {
        console.log("reactjrx", "query", serializedKey, "fetch", "cache hit!")
      }

      return hasCache
    },
    of({
      fetchStatus: "idle" as const,
      status: "success" as const,
      data: cacheResult,
      error: undefined
    }),
    execution$
  )
}
