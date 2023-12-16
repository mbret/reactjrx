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
  mergeMap,
  share
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
import { updateStoreWithNewQuery } from "./store/updateStoreWithNewQuery"
import { createCacheClient } from "./cache/cacheClient"
import { Logger } from "../../logger"
import { markQueryAsStaleIfRefetch } from "./refetch/markQueryAsStaleIfRefetch"
import { dispatchExternalRefetchToAllQueries } from "./refetch/dispatchExternalRefetchToAllQueries"
import { MutationClient } from "./mutations/MutationClient"
import { type MutationOptions } from "./mutations/types"
import { MutationCache } from "./mutations/cache/MutationCache"
import { MutationObserver } from "./mutations/MutationObserver"

export const createClient = ({
  client,
  mutationClient
}: {
  client: QueryClient
  mutationClient: MutationClient
}) => {
  const queryStore = createQueryStore()
  const invalidationClient = createInvalidationClient({ queryStore })
  const cacheClient = createCacheClient({ queryStore })
  const refetchClient = createRefetchClient({ queryStore })

  let hasCalledStart = false

  const query = <T>({
    key,
    fn$: maybeFn$,
    fn: maybeFn,
    trigger$: externalTrigger$ = new Subject(),
    options$ = new BehaviorSubject<QueryOptions<T>>({})
  }: {
    key: QueryKey
    fn?: QueryFn<T>
    fn$?: Observable<QueryFn<T>>
    trigger$?: Observable<QueryTrigger>
    options$?: Observable<QueryOptions<T>>
  }) => {
    if (!hasCalledStart) {
      throw new Error("You forgot to start client")
    }

    const serializedKey = serializeKey(key)
    const fn$ = maybeFn$ ?? (maybeFn ? of(maybeFn) : NEVER)

    Logger.log("query$)", serializedKey)

    const runner$ = options$.pipe(map((options) => ({ options })))

    let deleteRunner = () => {}

    const trigger$ = merge(
      externalTrigger$.pipe(
        dispatchExternalRefetchToAllQueries({
          queryStore,
          serializedKey
        })
      ),
      createQueryTrigger({
        options$,
        key: serializedKey,
        queryStore
      })
    ).pipe(share())

    const result$ = merge(
      of({
        type: "initial" as const
      }),
      trigger$
    ).pipe(
      updateStoreWithNewQuery({
        key,
        queryStore,
        runner$,
        serializedKey,
        options$
      }),
      map(([value, deleteRunnerFn]) => {
        if (deleteRunnerFn) {
          deleteRunner = deleteRunnerFn
        }

        return value
      }),
      markQueryAsStaleIfRefetch({
        key,
        options$,
        queryStore,
        serializedKey
      }),
      withLatestFrom(fn$, options$),
      map(([trigger, fn, options]) => ({ trigger, fn, options })),
      map((value) => {
        Logger.log(serializedKey, "query trigger", {
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
      mergeResults,
      withLatestFrom(options$),
      takeWhile(([result, options]) => {
        const shouldStop =
          result.data !== undefined && options.terminateOnFirstResult

        return !shouldStop
      }, true),
      map(([result]) => result),
      finalize(() => {
        deleteRunner()
      })
    ) as Observable<QueryResult<T>>

    return {
      result$
    }
  }

  const queryListener$ = createQueryListener(queryStore, (stream) =>
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
  )

  const destroy = () => {
    mutationClient.destroy()
  }

  const start = () => {
    hasCalledStart = true
    const queryListenerSub = queryListener$.subscribe()
    const started = [queryStore.start()]

    return () => {
      started.forEach((destroy) => {
        destroy()
      })
      queryListenerSub.unsubscribe()
    }
  }

  return {
    start,
    query,
    queryStore,
    mutationClient,
    ...invalidationClient,
    ...cacheClient,
    ...refetchClient,
    destroy
  }
}

export class QueryClient {
  public client: ReturnType<typeof createClient>
  protected mutationCache: MutationCache
  mutationClient: MutationClient
  public mutationObserver: MutationObserver

  constructor(
    { mutationCache }: { mutationCache: MutationCache } = {
      mutationCache: new MutationCache()
    }
  ) {
    this.mutationCache = mutationCache
    this.mutationClient = new MutationClient(this)
    this.mutationObserver = new MutationObserver(this)

    this.client = createClient({
      client: this,
      mutationClient: this.mutationClient
    })
  }

  mount() {
    const stop = this.client.start()

    return () => {
      stop()
    }
  }

  getMutationCache() {
    return this.mutationCache
  }

  defaultMutationOptions<T extends MutationOptions<any, any, any, any>>(
    options?: T
  ): T {
    // // if (options?._defaulted) {
    // //   return options
    // // }

    // return {
    //   // ...this.#defaultOptions.mutations,
    //   // ...(options?.mutationKey &&
    //   //   this.getMutationDefaults(options.mutationKey)),
    //   // ...options,
    //   // _defaulted: true
    // } as T

    return options as T
  }

  clear() {
    // this.client.
  }
}
