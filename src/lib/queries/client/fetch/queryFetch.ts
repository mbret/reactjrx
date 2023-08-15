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
  delay,
  endWith
} from "rxjs"
import {
  type QueryResult,
  type QueryFn,
  type QueryOptions,
  type QueryTrigger
} from "../types"
import { deduplicate } from "../deduplication/deduplicate"
import { type createQueryStore } from "../store/createQueryStore"
import { notifyQueryResult } from "./notifyQueryResult"
import { retryOnError } from "../operators"
import { registerResultInCache } from "../cache/registerResultInCache"
import { isDefined } from "../../../utils/isDefined"
import { mapWithComplete } from "./mapWithComplete"

export const createQueryFetch = <T>({
  options$,
  options,
  fn,
  queryStore,
  serializedKey,
  trigger,
  trigger$
}: {
  fn: QueryFn<T>
  options$: Observable<QueryOptions<T>>
  options: QueryOptions<T>
  queryStore: ReturnType<typeof createQueryStore>
  serializedKey: string
  trigger: QueryTrigger
  trigger$: Observable<QueryTrigger>
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
    retryOnError(options),
    deduplicate(serializedKey, queryStore),
    tap(() => {
      queryStore.dispatchQueryEvent({
        key: serializedKey,
        type: "fetchSuccess"
      })
      queryStore.update(serializedKey, {
        lastFetchedAt: new Date().getTime()
      })
    }),
    registerResultInCache({ serializedKey, options, queryStore }),
    mapWithComplete(({ isComplete }) => (result) => ({
      status: "success" as const,
      ...(isComplete && {
        fetchStatus: "idle" as const
      }),
      data: { result },
      error: undefined
    })),
    endWith({
      fetchStatus: "idle" as const
    }),
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
    notifyQueryResult(options$)
  )

  const newCache$ = queryStore.queryEvent$.pipe(
    filter(
      (event) => event.key === serializedKey && event.type === "queryDataSet"
    ),
    map(() => queryStore.get<T>(serializedKey)?.cache_fnResult?.result),
    filter(isDefined),
    map((result) => ({
      status: "success" as const,
      data: { result }
    })),
    /**
     * @important
     * To avoid cache update being returned being the first result is returned.
     * For example if user set query data inside onSuccess callback, we simulate
     * a small delay to ensure it happens after.
     */
    delay(1)
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
      fnExecution$
    ).pipe(takeUntil(disabled$)),
    newCache$
  ).pipe(takeUntil(trigger$))

  const query = queryStore.get(serializedKey)

  const cacheResult = query?.cache_fnResult as undefined | { result: T }

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
          fetchStatus: "fetching" as const,
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
