import {
  type Observable,
  Subject,
  defer,
  from,
  map,
  switchMap,
  merge,
  of,
  distinctUntilChanged,
  filter,
  takeUntil,
  catchError,
  take,
  withLatestFrom,
  BehaviorSubject,
  takeWhile,
  tap,
  skip
} from "rxjs"
import { autoRefetch } from "./autoRefetch"
import { deduplicate } from "./deduplication/deduplicate"
import { serializeKey } from "./keys/serializeKey"
import { mergeResults, notifyQueryResult } from "./operators"
import { type QueryResult, type QueryOptions, type QueryFn } from "./types"
import { retryQueryOnFailure } from "./retryQueryOnFailure"
import { type QueryKey } from "./keys/types"
import { createDeduplicationStore } from "./deduplication/createDeduplicationStore"
import { createQueryStore } from "./createQueryStore"
import { compareKeys } from "./keys/compareKeys"

export const createClient = () => {
  const queryStore = createQueryStore()
  const deduplicationStore = createDeduplicationStore()
  const refetch$ = new Subject<{
    key: any[]
  }>()

  const query$ = <T>({
    key,
    fn$,
    refetch$ = new Subject(),
    options$ = new BehaviorSubject<QueryOptions<T>>({})
  }: {
    key: QueryKey
    fn$: Observable<QueryFn<T>>
    refetch$?: Observable<void>
    options$?: Observable<QueryOptions<T>>
  }) => {
    const serializedKey = serializeKey(key)

    // console.log("query$()", serializedKey)

    const enabledOption$ = options$.pipe(
      map(({ enabled = true }) => enabled),
      distinctUntilChanged()
    )

    const disabled$ = enabledOption$.pipe(
      distinctUntilChanged(),
      filter((enabled) => !enabled)
    )

    // initial trigger
    const staleTrigger$ = queryStore.store$.pipe(
      map((store) => store.get(serializedKey)?.stale ?? true),
      skip(1),
      filter((stale) => stale)
    )

    const enabledTrigger$ = enabledOption$.pipe(
      skip(1),
      filter((enabled) => enabled)
    )

    const triggers$ = merge(
      of("initial"),
      refetch$,
      staleTrigger$,
      enabledTrigger$
    )

    const result$ = triggers$.pipe(
      tap((params) => {
        // console.log("query$ trigger", { key, params })
      }),
      withLatestFrom(fn$),
      withLatestFrom(options$),
      map(([[, fn], options]) => ({ fn, options })),
      filter(({ options }) => options.enabled !== false),
      tap(() => {
        queryStore.update(serializedKey, { stale: false })
      }),
      switchMap(({ fn, options }) => {
        const deferredQuery = defer(() => {
          const queryOrResponse = typeof fn === "function" ? fn() : fn

          return from(queryOrResponse)
        })

        return merge(
          disabled$.pipe(
            take(1),
            map(() => ({
              fetchStatus: "idle" as const
            }))
          ),
          merge(
            of({ fetchStatus: "fetching" as const, error: undefined }),
            deferredQuery.pipe(
              deduplicate(serializedKey, deduplicationStore),
              retryQueryOnFailure(options),
              map((result) => ({
                fetchStatus: "idle" as const,
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
              notifyQueryResult(options$)
            )
          ).pipe(autoRefetch(options$), takeUntil(disabled$))
        )
      }),
      mergeResults,
      withLatestFrom(options$),
      takeWhile(([result, options]) => {
        const shouldStop =
          result.data !== undefined && options.terminateOnFirstResult

        return !shouldStop
      }),
      map(([result]) => result)
      // finalize(() => {
      //   console.log("query$ finalize", new Date().getTime()  - 1691522856380)
      // })
    ) as Observable<
      QueryResult<T>
    > /* @see https://github.com/ReactiveX/rxjs/issues/4221 */

    return {
      result$
    }
  }

  const invalidateQueries = ({
    queryKey,
    exact = false,
    predicate
  }: {
    queryKey?: QueryKey
    exact?: boolean
    predicate?: Parameters<typeof queryStore.updateMany>[1]
  } = {}) => {
    if (queryKey) {
      queryStore.updateMany({ stale: true }, (storeObject) =>
        compareKeys(queryKey, storeObject.queryKey, { exact })
      )
    } else if (predicate) {
      queryStore.updateMany({ stale: true }, predicate)
    } else {
      queryStore.updateMany({ stale: true })
    }
  }

  return {
    query$,
    refetch$,
    queryStore: deduplicationStore,
    invalidateQueries,
    destroy: () => {
      // @todo cleanup
    }
  }
}
