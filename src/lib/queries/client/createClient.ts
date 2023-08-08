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
  takeWhile,
} from "rxjs"
import { autoRefetch } from "./autoRefetch"
import { deduplicate } from "./deduplicate"
import { serializeKey } from "./keys/serializeKey"
import { mergeResults, notifyQueryResult } from "./operators"
import { type QueryStore, type QueryResult, type QueryOptions } from "./types"
import { retryQueryOnFailure } from "./retryQueryOnFailure"
import { type QueryKey } from "./keys/types"

type Query<T> = (() => Promise<T>) | (() => Observable<T>) | Observable<T>

export const createClient = () => {
  const queryStore: QueryStore = new Map()
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
    fn$: Observable<Query<T>>
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
              isLoading: false
            }))
          ),
          merge(
            of({ isLoading: true, error: undefined }),
            deferredQuery.pipe(
              // tap(() => {
              //   console.log("after exec")
              // }),
              retryQueryOnFailure(options),
              deduplicate(serializedKey, queryStore),
              map((result) => ({
                isLoading: false,
                data: { result },
                error: undefined
              })),
              catchError((error) =>
                of({
                  isLoading: false,
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
      map(([result]) => result),
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

  return {
    query$,
    refetch$,
    queryStore,
    destroy: () => {
      // @todo cleanup
    }
  }
}
