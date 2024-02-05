import { BehaviorSubject, map, noop, switchMap, tap } from "rxjs"
import { type QueryClient } from "../../QueryClient"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { type Query } from "../query/Query"
import { type FetchOptions } from "../query/types"
import { type RefetchOptions } from "../types"
import { type QueryObserverResult, type QueryObserverOptions } from "./types"
import { shouldFetchOnMount } from "./queryStateHelpers"

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

  protected lastObservedResult: {
    state?: Query<TQueryFnData, TError, TQueryData, TQueryKey>["state"]
    result?: QueryObserverResult<TData, TError>
  } = {}

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
    this.options = this.#client.defaultQueryOptions(options)
    this.currentQuerySubject = new BehaviorSubject(
      this.buildQuery(this.options)
    )
  }

  protected bindMethods(): void {
    this.refetch = this.refetch.bind(this)
  }

  protected getQueryForOptions(
    options?: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
  ) {}

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

    if (query !== this.currentQuerySubject.getValue()) {
      this.currentQuerySubject.next(query)
    }

    if (!prevOptions.enabled && this.options.enabled) {
      this.refetch().catch(noop)
    }
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
    const data = state.data

    const getSelectedValue = (): {
      data?: TData | TQueryData
      error?: TError
      isSelected?: boolean
    } => {
      try {
        const selectFn = this.options.select

        if (selectFn && typeof data !== "undefined") {
          const lastObservedResultSelectedData =
            this.lastObservedResult.result?.data

          if (
            this.lastObservedResult?.state?.data === data &&
            lastObservedResultSelectedData !== undefined
          ) {
            return { data: lastObservedResultSelectedData }
          }

          return { data: selectFn(data), isSelected: true }
        }

        return { data }
      } catch (error) {
        return { error: error as TError }
      }
    }

    const {
      data: selectData,
      error: selectError,
      isSelected
    } = getSelectedValue()

    return {
      status: selectError ? "error" : query.state.status,
      fetchStatus: query.state.fetchStatus,
      isPending,
      isSuccess: query.state.status === "success",
      isError,
      isInitialLoading: isLoading,
      isLoading,
      data: isSelected ? selectData : data,
      dataUpdatedAt: query.state.dataUpdatedAt,
      error: selectError ?? query.state.error,
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
    const query = this.currentQuerySubject.getValue()

    await query.fetch(this.options)

    const result = this.getObserverResultFromQuery(query)

    return result
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
    if (shouldFetchOnMount(observedQuery, this.options)) {
      this.fetch().catch(noop)
    }

    const result$ = this.currentQuerySubject.pipe(
      switchMap((query) => {
        const initialObservedState = query.state

        return query.observe().pipe(
          map((state) => {
            const result = this.getObserverResultFromQuery(
              query,
              initialObservedState
            )

            this.lastObservedResult.result = result
            this.lastObservedResult.state = state

            return result
          })
        )
      }),
      tap({
        subscribe: () => {},
        unsubscribe: () => {}
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
