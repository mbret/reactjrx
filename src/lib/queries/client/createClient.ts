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
  EMPTY,
  of,
  finalize
} from "rxjs"
import { serializeKey } from "./keys/serializeKey"
import { mergeResults } from "./operators"
import { type QueryOptions, type QueryFn, type QueryTrigger } from "./types"
import { type QueryKey } from "./keys/types"
import { createDeduplicationStore } from "./deduplication/createDeduplicationStore"
import { createQueryStore } from "./createQueryStore"
import { createQueryTrigger } from "./triggers"
import { createQueryFetch } from "./queryFetch"
import { createInvalidationClient } from "./invalidation/client"
import { createRefetchClient } from "./refetch/client"

export const createClient = () => {
  const queryStore = createQueryStore()
  const deduplicationStore = createDeduplicationStore()
  const invalidationClient = createInvalidationClient({ queryStore })
  const refetchClient = createRefetchClient({ queryStore })
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
    const internalRefetch$ = new Subject<QueryTrigger>()

    console.log("query$()", serializedKey)

    if (!queryStore.get(serializedKey)) {
      queryStore.set(serializedKey, {
        isStale: true,
        queryKey: key,
        listeners: 0
      })
    } else {
      queryStore.update(serializedKey, {
        queryKey: key,
        isStale: true
      })
    }

    queryStore.addListener(serializedKey)

    const trigger$ = createQueryTrigger({
      options$,
      refetch$: merge(refetch$, internalRefetch$)
    })

    const result$ = trigger$.pipe(
      // hooks
      refetchClient.pipeQueryTrigger({ options$, key: serializedKey }),
      invalidationClient.pipeQueryTrigger({ options$, key: serializedKey }),
      tap((params) => {
        console.log("query$ trigger", { key, params })
      }),
      withLatestFrom(fn$, options$),
      map(([trigger, fn, options]) => ({ trigger, fn, options })),
      filter(({ options }) => options.enabled !== false),
      switchMap(({ fn, options, trigger }) =>
        createQueryFetch({
          options$,
          options,
          fn,
          deduplicationStore,
          queryStore,
          serializedKey,
          trigger
        })
      ),
      // hooks
      switchMap((result) =>
        merge(
          of(result).pipe(
            invalidationClient.pipeQueryResult({
              key: serializedKey,
              queryStore,
              options$
            })
          ),
          of(result).pipe(
            refetchClient.pipeQueryResult({
              key: serializedKey,
              queryStore,
              options$,
              refetch$: internalRefetch$
            })
          )
        )
      ),
      mergeResults
      // tap((result) => {
      //   console.log("query$ result", result)
      // })
      // finalize(() => {
      //   console.log("query$ finalize", new Date().getTime()  - 1691522856380)
      // })
    )

    return {
      result$: merge(result$).pipe(
        finalize(() => {
          queryStore.removeListener(serializedKey)
        }),
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

  return {
    query$,
    refetch$,
    queryStore: deduplicationStore,
    ...invalidationClient,
    ...refetchClient,
    destroy: () => {
      // @todo cleanup
      invalidationClient.destroy()
      queryStore.destroy()
      refetchClient.destroy()
    }
  }
}
