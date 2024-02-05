import { BehaviorSubject, map, noop, switchMap, tap } from "rxjs"
import { type QueryClient } from "../../QueryClient"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { type Query } from "../query/Query"
import { type QueryState, type FetchOptions } from "../query/types"
import { type RefetchOptions } from "../types"
import {
  type QueryObserverResult,
  type QueryObserverOptions,
  type DefaultedQueryObserverOptions
} from "./types"
import { shouldFetchOnMount } from "./queryStateHelpers"
import { shallowEqual } from "../../../../utils/shallowEqual"

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

  /**
   * Mostly used to compare the state before and after mount
   */
  protected queryInitialState: Query<
    TQueryFnData,
    TError,
    TQueryData,
    TQueryKey
  >["state"]

  /**
   * Mostly used for internal optimization such as not
   * running selectors twice, etc
   */
  protected lastObservedResult: {
    state: Query<TQueryFnData, TError, TQueryData, TQueryKey>["state"]
    result: QueryObserverResult<TData, TError>
    selectError?: null | TError
  }

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
    const query = this.currentQuerySubject.getValue()
    this.queryInitialState = query.state
    this.lastObservedResult = {
      state: query.state,
      result: this.getObserverResultFromQuery({
        query,
        options: this.options,
        lastObservedResult: {
          state: this.queryInitialState
        }
      }).result
    }
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

    if (query !== this.currentQuerySubject.getValue()) {
      this.queryInitialState = query.state
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

  protected getObserverResultFromQuery = ({
    options,
    query,
    lastObservedResult
  }: {
    query: Query<TQueryFnData, TError, TQueryData, TQueryKey>
    options: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
    lastObservedResult: {
      state: Query<TQueryFnData, TError, TQueryData, TQueryKey>["state"]
      result?: QueryObserverResult<TData, TError>
      selectError?: null | TError
    }
  }): { result: QueryObserverResult<TData, TError>; selectError?: TError } => {
    const state = query.state
    const isFetching = query.state.fetchStatus === "fetching"
    const isPending = query.state.status === "pending"
    const isError = query.state.status === "error"
    const isLoading = isPending && isFetching
    const data = state.data

    const getSelectedValue = (): {
      data?: TData
      error?: TError
      isSelected?: boolean
    } => {
      try {
        const selectFn = options.select

        if (selectFn && typeof data !== "undefined") {
          const lastObservedResultSelectedData = lastObservedResult.result?.data

          if (
            lastObservedResult.state.data === data &&
            lastObservedResultSelectedData !== undefined
          ) {
            if (lastObservedResult.selectError) {
              return { error: lastObservedResult.selectError }
            }

            return { data: lastObservedResultSelectedData, isSelected: true }
          }

          return { data: selectFn(data), isSelected: true }
        }

        return { data: data as TData }
      } catch (error) {
        return { error: error as TError }
      }
    }

    const {
      data: selectData,
      error: selectError,
      isSelected
    } = getSelectedValue()

    const result = {
      status: selectError ? "error" : query.state.status,
      fetchStatus: query.state.fetchStatus,
      isPending,
      isSuccess: query.state.status === "success",
      isError,
      isInitialLoading: isLoading,
      isLoading,
      data: isSelected ? selectData : (data as TData),
      dataUpdatedAt: query.state.dataUpdatedAt,
      error: selectError ?? query.state.error,
      errorUpdatedAt: 0,
      failureCount: query.state.fetchFailureCount,
      failureReason: query.state.fetchFailureReason,
      errorUpdateCount: query.state.errorUpdateCount,
      isFetched:
        query.state.dataUpdateCount > 0 || query.state.errorUpdateCount > 0,
      isFetchedAfterMount:
        state.dataUpdateCount > this.queryInitialState.dataUpdateCount ||
        state.errorUpdateCount > this.queryInitialState.errorUpdateCount,
      isFetching,
      isRefetching: false,
      isLoadingError: isError && state.dataUpdatedAt === 0,
      isPaused: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isStale: true,
      refetch: this.refetch
    }

    return {
      result,
      selectError
    }
  }

  getCurrentResult(): QueryObserverResult<TData, TError> {
    return this.lastObservedResult.result
  }

  getOptimisticResult(
    options: DefaultedQueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
  ): QueryObserverResult<TData, TError> {
    const query = this.#client.getQueryCache().build(this.#client, options)

    const observedResult = this.getObserverResultFromQuery({
      query,
      options,
      lastObservedResult: this.lastObservedResult
    })

    if (shouldAssignObserverCurrentProperties(this, observedResult.result)) {
      // this assigns the optimistic result to the current Observer
      // because if the query function changes, useQuery will be performing
      // an effect where it would fetch again.
      // When the fetch finishes, we perform a deep data cloning in order
      // to reuse objects references. This deep data clone is performed against
      // the `observer.currentResult.data` property
      // When QueryKey changes, we refresh the query and get new `optimistic`
      // result, while we leave the `observer.currentResult`, so when new data
      // arrives, it finds the old `observer.currentResult` which is related
      // to the old QueryKey. Which means that currentResult and selectData are
      // out of sync already.
      // To solve this, we move the cursor of the currentResult every time
      // an observer reads an optimistic value.
      // When keeping the previous data, the result doesn't change until new
      // data arrives.
      this.updateObservedResult({ query, ...observedResult })
    }

    return observedResult.result
  }

  protected updateObservedResult({
    query,
    result,
    selectError
  }: {
    query: Query<TQueryFnData, TError, TQueryData, TQueryKey>
    result: QueryObserverResult<TData, TError>
    selectError?: TError
  }) {
    this.lastObservedResult.state = query.state
    this.lastObservedResult.result = result
    this.lastObservedResult.selectError = selectError
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

    const { result } = this.getObserverResultFromQuery({
      query,
      options: this.options,
      lastObservedResult: this.lastObservedResult
    })

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
        return query.observe().pipe(
          map(() => {
            const result = this.getObserverResultFromQuery({
              query,
              options: this.options,
              lastObservedResult: this.lastObservedResult
            })

            this.updateObservedResult({ query, ...result })

            return result.result
          })
        )
      }),
      tap({
        subscribe: () => {},
        unsubscribe: () => {}
      })
    )

    return { result$ }
  }

  destroy(): void {
    // this.#clearStaleTimeout()
    // this.#clearRefetchInterval()
    // this.#currentQuery.removeObserver(this)
  }
}

// this function would decide if we will update the observer's 'current'
// properties after an optimistic reading via getOptimisticResult
function shouldAssignObserverCurrentProperties<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  observer: QueryObserver<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  optimisticResult: QueryObserverResult<TData, TError>
) {
  // if the newly created result isn't what the observer is holding as current,
  // then we'll need to update the properties as well
  if (!shallowEqual(observer.getCurrentResult(), optimisticResult)) {
    return true
  }

  // basically, just keep previous properties if nothing changed
  return false
}
