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
  share,
  take,
  timer,
  tap
} from "rxjs"
import { createCacheClient } from "../../oldqueries/cache/cacheClient"
import { createInvalidationClient } from "../../oldqueries/invalidation/invalidationClient"
import { createRefetchClient } from "../../oldqueries/refetch/client"
import { createQueryStore } from "../../oldqueries/store/createQueryStore"
import {
  type DeprecatedQueryOptions,
  type QueryFn,
  type QueryTrigger,
  type QueryResult,
  type DefaultError
} from "../../types"
import { type QueryKey } from "../../keys/types"
import { serializeKey } from "../../keys/serializeKey"
import { createQueryTrigger } from "../../triggers"
import { dispatchExternalRefetchToAllQueries } from "../../oldqueries/refetch/dispatchExternalRefetchToAllQueries"
import { Logger } from "../../../../logger"
import { updateStoreWithNewQuery } from "../../oldqueries/store/updateStoreWithNewQuery"
import { markQueryAsStaleIfRefetch } from "../../oldqueries/refetch/markQueryAsStaleIfRefetch"
import { createQueryFetch } from "../../oldqueries/fetch/queryFetch"
import { mergeResults } from "../../operators"
import { createQueryListener } from "../../oldqueries/store/queryListener"
import { invalidateCache } from "../../oldqueries/cache/invalidateCache"
import { markAsStale } from "../../oldqueries/invalidation/markAsStale"
import { garbageCache } from "../../oldqueries/store/garbageCache"
import { Query } from "../query/Query"
import { type QueryOptions, type QueryFilters } from "../types"
import { hashQueryKeyByOptions, matchQuery } from "../utils"
import { type QueryClient } from "../../QueryClient"
import { type QueryState } from "../query/types"
import { nanoid } from "../../keys/nanoid"
import { type WithRequired } from "../../../../utils/types"
import { isQueryFinished } from "../query/operators"

export const createClient = () => {
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
    options$ = new BehaviorSubject<DeprecatedQueryOptions<T>>({})
  }: {
    key: QueryKey
    fn?: QueryFn<T>
    fn$?: Observable<QueryFn<T>>
    trigger$?: Observable<QueryTrigger>
    options$?: Observable<DeprecatedQueryOptions<T>>
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

  const destroy = () => {}

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
    ...invalidationClient,
    ...cacheClient,
    ...refetchClient,
    destroy
  }
}

export interface QueryStore {
  has: (queryHash: string) => boolean
  set: (queryHash: string, query: Query) => void
  get: (queryHash: string) => Query | undefined
  delete: (queryHash: string) => void
  values: () => IterableIterator<Query>
}

export class QueryCache {
  public client = createClient()
  readonly #queries: QueryStore = new Map<string, Query>()

  getAll(): Query[] {
    return [...this.#queries.values()]
  }

  findAll(filters: QueryFilters = {}): Query[] {
    const queries = this.getAll()
    return Object.keys(filters).length > 0
      ? queries.filter((query) => matchQuery(filters, query))
      : queries
  }

  build<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
    client: QueryClient,
    options: QueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    state?: QueryState<TData, TError>
  ): Query<TQueryFnData, TError, TData, TQueryKey> {
    const queryKey = options.queryKey ?? ([nanoid()] as unknown as TQueryKey)
    const queryHash =
      options.queryHash ?? hashQueryKeyByOptions(queryKey, options)
    let query = this.get<TQueryFnData, TError, TData, TQueryKey>(queryHash)

    if (!query) {
      query = new Query({
        cache: this,
        queryKey,
        queryHash,
        options: client.defaultQueryOptions(options),
        state,
        defaultOptions: client.getQueryDefaults(queryKey)
      })
      this.add(query)
    }

    return query
  }

  add(query: Query<any, any, any, any>): void {
    if (!this.#queries.has(query.queryHash)) {
      this.#queries.set(query.queryHash, query)

      // @todo use observer

      const noMoreObservers$ = query.observerCount$.pipe(
        tap((count) => { console.log("observerCount", count); }),
        filter((count) => count <= 1),
        take(1)
      )

      /**
       * @important
       * unsubscribe automatically when mutation is done and gc collected
       */
      query.state$
        .pipe(
          /**
           * Once a mutation is finished and there are no more observers than us
           * we start the process of cleaning it up based on gc settings
           */
          isQueryFinished,
          switchMap((isFinished) => {
            console.log("FINISHED", isFinished)
            return !isFinished
              ? NEVER
              : noMoreObservers$.pipe(
                  // defaults to 5mn
                  switchMap(() => {
                    return timer(query.options.gcTime ?? 5 * 60 * 1000)
                  })
                )
          }),
          take(1)
        )
        .subscribe({
          complete: () => {
            /**
             * Will remove the mutation in all cases
             * - mutation cancelled (complete)
             * - mutation is finished (success /error)
             * - this subscription complete (external remove)
             */
            this.remove(query)
          }
        })
    }
  }

  get<
    TQueryFnData = unknown,
    TError = DefaultError,
    TData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey
  >(
    queryHash: string
  ): Query<TQueryFnData, TError, TData, TQueryKey> | undefined {
    return this.#queries.get(queryHash) as
      | Query<TQueryFnData, TError, TData, TQueryKey>
      | undefined
  }

  find<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData>(
    filters: WithRequired<QueryFilters, "queryKey">
  ): Query<TQueryFnData, TError, TData> | undefined {
    const defaultedFilters = { exact: true, ...filters }

    return this.getAll().find((query) =>
      matchQuery(defaultedFilters, query)
    ) as Query<TQueryFnData, TError, TData> | undefined
  }

  remove(query: Query<any, any, any, any>): void {
    const queryInMap = this.#queries.get(query.queryHash)

    if (queryInMap) {
      query.destroy()

      if (queryInMap === query) {
        this.#queries.delete(query.queryHash)
      }
    }
  }

  clear() {}
}
