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
  combineLatest,
  startWith,
  takeUntil,
  catchError,
  take,
  withLatestFrom,
  BehaviorSubject,
  takeWhile
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
    const enabled$ = options$.pipe(map(({ enabled = true }) => enabled))

    const disabled$ = enabled$.pipe(
      distinctUntilChanged(),
      filter((enabled) => !enabled)
    )

    const triggers = [
      refetch$.pipe(startWith(null)),
      enabled$.pipe(
        distinctUntilChanged(),
        filter((enabled) => enabled)
      )
    ]

    const serializedKey = serializeKey(key)

    const result$: Observable<QueryResult<T>> = combineLatest(triggers).pipe(
      // tap((params) => {
      //   console.log("query$ trigger", { key, params })
      // }),
      withLatestFrom(fn$),
      withLatestFrom(options$),
      switchMap(([[, query], options]) => {
        const deferredQuery = defer(() => {
          const queryOrResponse = typeof query === "function" ? query() : query

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
      // tap((data) => {
      //   console.log("query$ return", new Date().getTime()  - 1691522856380, data)
      // }),
      // finalize(() => {
      //   console.log("query$ finalize", new Date().getTime()  - 1691522856380)
      // })
    )

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
