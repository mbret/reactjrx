import {
  map,
  switchMap,
  filter,
  NEVER,
  take,
  timer,
  tap,
  distinctUntilChanged,
  startWith,
  noop
} from "rxjs"
import {
  type DefaultError
} from "../../types"
import { type QueryKey } from "../../keys/types"
import { Query } from "../query/Query"
import { type QueryOptions, type QueryFilters } from "../types"
import { hashQueryKeyByOptions, matchQuery } from "../utils"
import { type QueryClient } from "../../QueryClient"
import { type QueryState } from "../query/types"
import { nanoid } from "../../keys/nanoid"
import { type WithRequired } from "../../../../utils/types"
import { isQueryFinished } from "../query/operators"
import { Store } from "../../store"

export interface QueryStore {
  has: (queryHash: string) => boolean
  set: (queryHash: string, query: Query) => void
  get: (queryHash: string) => Query | undefined
  delete: (queryHash: string) => void
  values: () => IterableIterator<Query>
}

export class QueryCache {
  // readonly #queries: QueryStore = new Map<string, Query>()

  readonly #store = new Store<Query>()

  // protected mountSubscriptions: Subscription[]

  mount() {
    // this.mountSubscriptions
  }

  unmount() {
    // this.mountSubscriptions.forEach((sub) => sub.unsubscribe)
    // this.mountSubscriptions = []
  }

  observeIsFetching(filters?: QueryFilters) {
    const value$ = this.#store.stateChange$.pipe(
      tap(() => {
        // console.log("STATE CHANGE", value)
      }),
      // we force a first result
      startWith(),
      map(() => {
        const filteredEntities = this.findAll({
          ...filters,
          fetchStatus: "fetching"
        })

        return filteredEntities.length
      }),
      distinctUntilChanged()
    )

    return value$
  }

  getAll(): Query[] {
    return [...this.#store.getValues()]
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
    if (!this.#store.find((entity) => entity.queryHash === query.queryHash)) {
      this.#store.add(query)

      const noMoreObservers$ = query.observerCount$.pipe(
        tap(() => {
          // console.log("observerCount", count)
        }),
        filter((count) => count < 1),
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
            return !isFinished
              ? NEVER
              : noMoreObservers$.pipe(
                  // defaults to 5mn
                  switchMap(() => {
                    if (query.gcTime === Infinity) return NEVER

                    // needed to pass the rq test. to be fair the timer below should be
                    // valid as well (I even thought it would call setTimeout internally)
                    setTimeout(noop, query.gcTime)
                    return timer(query.gcTime)
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
    return this.#store.find((query) => query.queryHash === queryHash) as
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
    const queryInMap = this.#store.find((entity) => entity === query)

    if (queryInMap) {
      query.destroy()

      if (queryInMap === query) {
        this.#store.remove(query)
      }
    }
  }

  clear() {}
}
