import { noop } from "rxjs"
import { type QueryClient } from "../../QueryClient"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { type Query } from "../query/Query"
import { type FetchOptions } from "../query/types"
import { type QueryObserverResult, type RefetchOptions } from "../types"
import { type QueryObserverOptions } from "./types"

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
  readonly #currentQuery: Query<TQueryFnData, TError, TQueryData, TQueryKey>

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
    this.options = this.setOptions(options)
    this.#currentQuery = this.buildQuery(this.options)
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
    this.options = this.#client.defaultQueryOptions(options)

    return this.options
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
    return {
      status: query.state.status,
      fetchStatus: query.state.fetchStatus,
      isPending: false,
      isSuccess: query.state.status === "success",
      isError: query.state.status === "error",
      isInitialLoading: false,
      isLoading: false,
      data: query.state.data,
      dataUpdatedAt: query.state.dataUpdatedAt,
      error: undefined,
      errorUpdatedAt: 0,
      failureCount: query.state.fetchFailureCount,
      failureReason: query.state.fetchFailureReason,
      errorUpdateCount: query.state.errorUpdateCount,
      isFetched:
        query.state.dataUpdateCount > 0 || query.state.errorUpdateCount > 0,
      isFetchedAfterMount: false,
      isFetching: false,
      isRefetching: false,
      isLoadingError: false,
      isPaused: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isStale: false,
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

  subscribe(listener: () => void) {
    this.fetch().catch(noop)

    const sub = this.#currentQuery.observe().subscribe()

    return () => {
      sub.unsubscribe()
    }
  }
}
