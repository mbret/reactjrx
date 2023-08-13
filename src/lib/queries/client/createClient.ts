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
  NEVER
} from "rxjs"
import { serializeKey } from "./keys/serializeKey"
import { mergeResults } from "./operators"
import { type QueryOptions, type QueryFn, type QueryTrigger } from "./types"
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

export const createClient = () => {
  const queryStore = createQueryStore()
  const invalidationClient = createInvalidationClient({ queryStore })
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

    const trigger$ = createQueryTrigger({
      options$,
      refetch$: merge(refetch$, internalRefetch$),
      key: serializedKey,
      queryStore
    })

    const result$ = trigger$.pipe(
      refetchClient.pipeQueryTrigger({ options$, key: serializedKey }),
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
      switchMap(({ fn, options, trigger }) =>
        createQueryFetch({
          options$,
          options,
          fn,
          queryStore,
          serializedKey,
          trigger
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
      mergeResults
    )

    return {
      result$: merge(result$).pipe(
        withLatestFrom(options$),
        takeWhile(([result, options]) => {
          const shouldStop =
            result.data !== undefined && options.terminateOnFirstResult

          return !shouldStop
        }),
        map(([result]) => result),
        finalize(() => {
          deleteRunner()
        })
      )
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
    ...refetchClient,
    destroy: () => {
      invalidationClient.destroy()
      queryStore.destroy()
      refetchClient.destroy()
      queryListenerSub.unsubscribe()
    }
  }
}
