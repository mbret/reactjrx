import {
  type Observable,
  Subject,
  map,
  switchMap,
  filter,
  withLatestFrom,
  BehaviorSubject,
  takeWhile,
  tap,
  merge,
  mergeMap,
  EMPTY
} from "rxjs"
import { serializeKey } from "./keys/serializeKey"
import { mergeResults } from "./operators"
import { type QueryOptions, type QueryFn } from "./types"
import { type QueryKey } from "./keys/types"
import { createDeduplicationStore } from "./deduplication/createDeduplicationStore"
import { createQueryStore } from "./createQueryStore"
import { staleQuery } from "./invalidation/staleQuery"
import { createQueryTrigger } from "./triggers"
import { createQueryFetch } from "./queryFetch"
import { createInvalidationClient } from "./invalidation/client"

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
    refetch$?: Observable<{ ignoreStale: boolean }>
    options$?: Observable<QueryOptions<T>>
  }) => {
    const serializedKey = serializeKey(key)

    console.log("query$()", serializedKey)

    if (!queryStore.get(serializedKey)) {
      queryStore.set(serializedKey, {
        queryKey: key,
        stale: true
      })
    }

    const trigger$ = createQueryTrigger({ options$, refetch$ })

    const clearCacheOnNewQuery$ = fn$.pipe(
      tap(() => {
        queryStore.update(serializedKey, { queryCacheResult: undefined })
      }),
      mergeMap(() => EMPTY)
    )

    const result$ = trigger$.pipe(
      tap((params) => {
        console.log("query$ trigger", { key, params })
      }),
      withLatestFrom(fn$, options$),
      map(([trigger, fn, options]) => ({ trigger, fn, options })),
      filter(({ options }) => options.enabled !== false),
      filter(({ trigger }) => {
        const hasExistingCache =
          !!queryStore.get(serializedKey)?.queryCacheResult
        const isNotStale = !queryStore.get(serializedKey)?.stale

        const shouldSkip =
          !trigger.ignoreStale && isNotStale && hasExistingCache

        if (shouldSkip) {
          console.log("reactjrx", "query", serializedKey, "skipping fetch")
        }

        return !shouldSkip
      }),
      switchMap(({ fn, options }) =>
        createQueryFetch({
          options$,
          options,
          fn,
          deduplicationStore,
          queryStore,
          serializedKey
        })
      ),
      staleQuery({
        key: serializedKey,
        queryStore,
        options$
      }),
      mergeResults
      // tap((result) => {
      //   console.log("query$ result", result)
      // })
      // finalize(() => {
      //   console.log("query$ finalize", new Date().getTime()  - 1691522856380)
      // })
    )

    return {
      result$: merge(result$, clearCacheOnNewQuery$).pipe(
        withLatestFrom(options$),
        takeWhile(([result, options]) => {
          const shouldStop =
            result.data !== undefined && options.terminateOnFirstResult

          return !shouldStop
        }),
        map(([result]) => result)
      )
    }
  }

  const invalidationClient = createInvalidationClient({ queryStore })

  const storeSub = queryStore.store$.subscribe((value) => {
    console.log("reactjrx", "client", "store", "update", value)
  })

  return {
    query$,
    refetch$,
    queryStore: deduplicationStore,
    ...invalidationClient,
    destroy: () => {
      // @todo cleanup
      storeSub.unsubscribe()
    }
  }
}
