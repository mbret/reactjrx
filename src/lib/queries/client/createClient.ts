import {
  type Observable,
  Subject,
  defer,
  from,
  map,
  switchMap,
  tap,
  merge,
  of,
  distinctUntilChanged,
  filter,
  combineLatest,
  startWith,
  takeUntil,
  catchError,
  take,
  withLatestFrom
} from "rxjs"
import { autoRefetch } from "../invalidation/autoRefetch"
import { type QuerxOptions } from "../types"
import { deduplicate } from "../deduplication/deduplicate"
import { serializeKey } from "../keys/serializeKey"
import { mergeResults, notifyQueryResult } from "./operators"
import { type QueryResult } from "./types"

type Query<T> = (() => Promise<T>) | (() => Observable<T>) | Observable<T>

export const createClient = () => {
  const queryStore = new Map()
  const refetch$ = new Subject<{
    key: any[]
  }>()

  const query$ = <T>({
    key,
    fn$,
    options$
  }: {
    key: any[]
    fn$: Observable<Query<T>>
    options$: Observable<QuerxOptions<T>>
  }) => {
    const refetch$ = new Subject<void>()

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

    const query$: Observable<QueryResult<T>> = combineLatest(triggers).pipe(
      tap((params) => {
        console.log("query$ trigger", { key, params })
      }),
      withLatestFrom(fn$),
      switchMap(([, query]) => {
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
      tap((data) => {
        console.log("query$ return", data)
      })
    )

    return {
      query$,
      refetch$,
      enabled$
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
