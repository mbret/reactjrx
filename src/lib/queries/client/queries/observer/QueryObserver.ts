import { map, noop } from "rxjs"
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
  #currentQuery: Query<TQueryFnData, TError, TQueryData, TQueryKey>

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
    this.#currentQuery = initOptions.query
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
    this.#currentQuery = this.buildQuery(this.options)

    if (!prevOptions.enabled && this.options.enabled) {
      this.refetch().catch(noop)
    }

    // this.fetch().catch(noop)

    return { options: this.options, query: this.#currentQuery }
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
    query: Query<TQueryFnData, TError, TQueryData, TQueryKey>
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
      isFetchedAfterMount:
        state.dataUpdateCount > queryInitialState.dataUpdateCount ||
        state.errorUpdateCount > queryInitialState.errorUpdateCount,
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
    await this.#currentQuery.fetch()

    return this.getObserverResultFromQuery(this.#currentQuery)
  }

  getCurrentResult(): QueryObserverResult<TData, TError> {
    return this.getObserverResultFromQuery(this.#currentQuery)
  }

  subscribe(listener: () => void) {
    const sub = this.observe().result$.subscribe()

    return () => {
      sub.unsubscribe()
    }
  }

  observe() {
    this.fetch().catch(noop)

    const result$ = this.#currentQuery
      .observe()
      .pipe(map(() => this.getObserverResultFromQuery(this.#currentQuery)))

    const result = this.getCurrentResult()

    return { result$, result }
  }

  destroy(): void {
    // this.#clearStaleTimeout()
    // this.#clearRefetchInterval()
    // this.#currentQuery.removeObserver(this)
  }
}
