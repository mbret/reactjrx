import {
  type Observable,
  Subject,
  map,
  switchMap,
  filter,
  withLatestFrom,
  BehaviorSubject,
  takeWhile,
  merge,
  of,
  finalize,
  NEVER,
  tap,
  mergeMap
} from "rxjs"
import { serializeKey } from "./keys/serializeKey"
import { mergeResults } from "./operators"
import {
  type QueryOptions,
  type QueryFn,
  type QueryTrigger,
  type QueryResult
} from "./types"
import { type QueryKey } from "./keys/types"
import { createQueryStore } from "./store/createQueryStore"
import { createQueryTrigger } from "./triggers"
import { createQueryFetch } from "./fetch/queryFetch"
import { createInvalidationClient } from "./invalidation/invalidationClient"
import { createRefetchClient } from "./refetch/client"
import { createQueryListener } from "./store/queryListener"
import { markAsStale } from "./invalidation/markAsStale"
import { invalidateCache } from "./cache/invalidateCache"
import { garbageCache } from "./store/garbageCache"
import { updateStoreWithQuery } from "./store/updateStoreWithQuery"
import { createCacheClient } from "./cache/cacheClient"

export const createClient = () => {
  const queryStore = createQueryStore()
  const invalidationClient = createInvalidationClient({ queryStore })
  const cacheClient = createCacheClient({ queryStore })
  const refetchClient = createRefetchClient({ queryStore })

  const query$ = <T>({
    key,
    fn$: maybeFn$,
    fn: maybeFn,
    refetch$ = new Subject(),
    options$ = new BehaviorSubject<QueryOptions<T>>({})
  }: {
    key: QueryKey
    fn?: QueryFn<T>
    fn$?: Observable<QueryFn<T>>
    refetch$?: Observable<{ ignoreStale: boolean }>
    options$?: Observable<QueryOptions<T>>
  }) => {
    const serializedKey = serializeKey(key)
    const internalRefetch$ = new Subject<QueryTrigger>()
    const fn$ = maybeFn$ ?? (maybeFn ? of(maybeFn) : NEVER)

    console.log("query$()", serializedKey)

    const runner$ = options$.pipe(map((options) => ({ options })))

    let deleteRunner = () => {}

    const initialTrigger$ = of({
      type: "initial",
      ignoreStale: false
    })

    const trigger$ = createQueryTrigger({
      options$,
      refetch$: merge(refetch$, internalRefetch$),
      key: serializedKey,
      queryStore
    }).pipe(refetchClient.pipeQueryTrigger({ options$, key: serializedKey }))

    const result$ = merge(initialTrigger$, trigger$).pipe(
      withLatestFrom(fn$, options$),
      map(([trigger, fn, options]) => ({ trigger, fn, options })),
      updateStoreWithQuery({
        key,
        queryStore,
        runner$,
        serializedKey
      }),
      map(([value, deleteRunnerFn]) => {
        deleteRunner = deleteRunnerFn

        console.log("reactjrx", serializedKey, "query trigger", {
          trigger: value.trigger,
          options: value.options
        })

        return value
      }),
      filter(({ options }) => options.enabled !== false),
      mergeMap(({ fn, options, trigger }) =>
        createQueryFetch({
          options$,
          options,
          fn,
          queryStore,
          serializedKey,
          trigger,
          trigger$
        })
      ),
      // hooks
      switchMap((result) =>
        merge(
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
      mergeResults,
      withLatestFrom(options$),
      takeWhile(([result, options]) => {
        const shouldStop =
          result.data !== undefined && options.terminateOnFirstResult

        return !shouldStop
      }, true),
      map(([result]) => result),
      tap((result) => {
        console.log("result", result)
      }),
      finalize(() => {
        deleteRunner()
      })
    ) as Observable<QueryResult<T>>

    return {
      result$
    }
  }

  const queryListenerSub = createQueryListener(queryStore, (stream) =>
    stream.pipe(
      switchMap((key) => {
        const key$ = of(key)

        return merge(
          invalidateCache({
            queryStore
          })(key$),
          markAsStale({
            queryStore
          })(key$),
          garbageCache({
            queryStore
          })(key$)
        )
      })
    )
  ).subscribe()

  return {
    query$,
    queryStore,
    ...invalidationClient,
    ...cacheClient,
    ...refetchClient,
    destroy: () => {
      invalidationClient.destroy()
      queryStore.destroy()
      refetchClient.destroy()
      queryListenerSub.unsubscribe()
    }
  }
}
