import { BehaviorSubject, map, noop, switchMap, tap } from "rxjs"
import { type QueryClient } from "../../QueryClient"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { type Query } from "../query/Query"
import { type FetchOptions } from "../query/types"
import { type RefetchOptions } from "../types"
import { type QueryObserverResult, type QueryObserverOptions } from "./types"

export interface ObserverFetchOptions extends FetchOptions {
  throwOnError?: boolean
}

export interface NotifyOptions {
  listeners?: boolean
}

export class QueryObserver<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> {
  readonly #client: QueryClient
  readonly currentQuerySubject: BehaviorSubject<
    Query<TQueryFnData, TError, TQueryData, TQueryKey>
  >

  protected isObserving = false

  readonly #currentRefetchInterval?: number | false

  constructor(
    client: QueryClient,
    public options: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
  ) {
    this.#client = client
    this.bindMethods()
    const initOptions = this.setOptions(options)
    this.currentQuerySubject = initOptions.query
    this.options = initOptions.options
  }

  protected bindMethods(): void {
    this.refetch = this.refetch.bind(this)
  }

  setOptions(
    options?: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >,
    notifyOptions?: NotifyOptions
  ) {
    const prevOptions = this.options
    this.options = this.#client.defaultQueryOptions(options)
    const query = this.buildQuery(this.options)
    const currentQuery = new BehaviorSubject(query)

    if (!prevOptions.enabled && this.options.enabled) {
      this.refetch().catch(noop)
    }

    // this.fetch().catch(noop)

    return { options: this.options, query: currentQuery }
  }

  buildQuery(
    options: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
  ) {
    const query = this.#client.getQueryCache().build(this.#client, options)

    return query
  }

  protected getObserverResultFromQuery = (
    query: Query<TQueryFnData, TError, TQueryData, TQueryKey>,
    lastObservedState?: typeof query.state
  ): QueryObserverResult<TData, TError> => {
    const state = query.state
    const isFetching = query.state.fetchStatus === "fetching"
    const isPending = query.state.status === "pending"
    const isError = query.state.status === "error"
    const isLoading = isPending && isFetching
    const queryInitialState = query.getInitialState()

    return {
      status: query.state.status,
      fetchStatus: query.state.fetchStatus,
      isPending,
      isSuccess: query.state.status === "success",
      isError,
      isInitialLoading: isLoading,
      isLoading,
      data: query.state.data,
      dataUpdatedAt: query.state.dataUpdatedAt,
      error: query.state.error,
      errorUpdatedAt: 0,
      failureCount: query.state.fetchFailureCount,
      failureReason: query.state.fetchFailureReason,
      errorUpdateCount: query.state.errorUpdateCount,
      isFetched:
        query.state.dataUpdateCount > 0 || query.state.errorUpdateCount > 0,
      isFetchedAfterMount: !lastObservedState
        ? false
        : state.dataUpdateCount > lastObservedState.dataUpdateCount ||
          state.errorUpdateCount > lastObservedState.errorUpdateCount,
      isFetching,
      isRefetching: false,
      isLoadingError: isError && state.dataUpdatedAt === 0,
      isPaused: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isStale: true,
      refetch: this.refetch
    }
  }

  async refetch({ ...options }: RefetchOptions = {}): Promise<
    QueryObserverResult<TData, TError>
  > {
    return await this.fetch({
      ...options
    })
  }

  protected async fetch(
    fetchOptions?: ObserverFetchOptions
  ): Promise<QueryObserverResult<TData, TError>> {
    await this.currentQuerySubject.getValue().fetch(this.options)

    return this.getObserverResultFromQuery(this.currentQuerySubject.getValue())
  }

  subscribe(listener: () => void) {
    const sub = this.observe().result$.subscribe()

    return () => {
      sub.unsubscribe()
    }
  }

  observe() {
    const observedQuery = this.currentQuerySubject.getValue()

    // needs to be before the return of the first result.
    // whether the consumer subscribe or not
    // the function needs to run at least in the next tick (or its result)
    // to have a proper flow (see isFetchedAfterMount). We get inconsistencies
    // otherwise
    this.fetch().catch(noop)

    const result$ = this.currentQuerySubject.pipe(
      switchMap((query) => {
        const initialObservedState = query.state

        return query
          .observe()
          .pipe(
            map(() =>
              this.getObserverResultFromQuery(query, initialObservedState)
            )
          )
      }),
      tap({
        subscribe: () => {
          this.isObserving = true
        },
        unsubscribe: () => {
          this.isObserving = false
        }
      })
    )

    const result = this.getObserverResultFromQuery(observedQuery)

    return { result$, result }
  }

  destroy(): void {
    // this.#clearStaleTimeout()
    // this.#clearRefetchInterval()
    // this.#currentQuery.removeObserver(this)
  }
}
