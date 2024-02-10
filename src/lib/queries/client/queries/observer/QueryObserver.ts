import {
  BehaviorSubject,
  Subject,
  distinctUntilChanged,
  filter,
  finalize,
  ignoreElements,
  map,
  merge,
  noop,
  pairwise,
  share,
  startWith,
  switchMap,
  tap,
  timer
} from "rxjs"
import { type QueryClient } from "../../QueryClient"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { type Query } from "../query/Query"
import { type FetchOptions } from "../query/types"
import { type RefetchOptions } from "../types"
import {
  type QueryObserverResult,
  type QueryObserverOptions,
  type DefaultedQueryObserverOptions
} from "./types"
import {
  isStale,
  shouldFetchOnMount,
  shouldFetchOptionally
} from "./queryStateHelpers"
import { shallowEqual } from "../../../../utils/shallowEqual"
import { filterObjectByKey } from "../../../../utils/filterObjectByKey"
import { trackSubscriptions } from "../../../../utils/operators/trackSubscriptions"

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
  protected currentQuery: Query<TQueryFnData, TError, TQueryData, TQueryKey>
  protected options: QueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >

  /**
   * Used to subscribe to changes in either query or options (or both).
   * We need to be able to track change to both of them at the same time
   * in order to react accordingly and in order (such as refetch on options change)
   */
  readonly queryUpdateSubject = new Subject<{
    options: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
    query: Query<TQueryFnData, TError, TQueryData, TQueryKey>
  }>()

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
  protected lastResult: {
    state: Query<TQueryFnData, TError, TQueryData, TQueryKey>["state"]
    result: QueryObserverResult<TData, TError>
    selectError?: null | TError
  }

  protected observers = 0

  constructor(
    client: QueryClient,
    options: QueryObserverOptions<
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
    this.currentQuery = this.buildQuery(this.options)
    const query = this.currentQuery
    this.queryInitialState = query.state
    this.lastResult = {
      state: query.state,
      result: this.getObserverResultFromQuery({
        query,
        options: this.options
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
    const newOptions = this.#client.defaultQueryOptions(options)

    this.options = newOptions
    const query = this.buildQuery(this.options)

    if (query !== this.currentQuery) {
      this.queryInitialState = query.state
      this.currentQuery = query
    }

    this.queryUpdateSubject.next({
      options: newOptions,
      query
    })
  }

  protected buildQuery(
    options: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
  ) {
    const query = this.#client.getQueryCache().build(this.#client, options)

    // Use the options from the first observer with a query function if no function is found.
    // This can happen when the query is hydrated or created with setQueryData.
    if (!query.options.queryFn && this.options.queryFn) {
      query.setOptions(options)
    }

    return query
  }

  protected getObserverResultFromQuery = ({
    options,
    query,
    optimisticResult
  }: {
    query: Query<TQueryFnData, TError, TQueryData, TQueryKey>
    options: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
    optimisticResult?: boolean
  }): { result: QueryObserverResult<TData, TError>; selectError?: TError } => {
    const state = query.state
    const isPending = query.state.status === "pending"
    const isError = query.state.status === "error"
    const prevQuery = this.currentQuery
    const prevOptions = this.options
    const lastObservedResult = this.lastResult

    let fetchStatus = query.state.fetchStatus

    if (optimisticResult) {
      const mounted = !!this.observers

      const fetchOnMount = !mounted && shouldFetchOnMount(query, options)

      const fetchOptionally =
        mounted && shouldFetchOptionally(query, prevQuery, options, prevOptions)

      if (fetchOnMount || fetchOptionally) {
        fetchStatus = "fetching"
      }
    }

    // console.log({
    //   mounted,
    //   fetchOnMount,
    //   fetchOptionally,
    //   diff: prevQuery === query
    // })

    const isLoading = isPending && fetchStatus === "fetching"
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
      fetchStatus,
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
      isFetching: fetchStatus === "fetching",
      isRefetching: false,
      isLoadingError: isError && state.dataUpdatedAt === 0,
      isPaused: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isStale: isStale(query, options),
      refetch: this.refetch
    }

    return {
      result,
      selectError
    }
  }

  getCurrentResult(): QueryObserverResult<TData, TError> {
    return this.lastResult.result
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
    const query = this.buildQuery(options)

    const observedResult = this.getObserverResultFromQuery({
      query,
      options,
      optimisticResult: true
    })

    // if (shouldAssignObserverCurrentProperties(this, observedResult.result)) {
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
    // }

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
    this.lastResult.state = query.state
    this.lastResult.result = result
    this.lastResult.selectError = selectError
  }

  async refetch({ ...options }: RefetchOptions = {}): Promise<
    QueryObserverResult<TData, TError>
  > {
    console.log("refetch")
    return await this.fetch({
      ...options
    })
  }

  protected async fetch(
    fetchOptions?: ObserverFetchOptions
  ): Promise<QueryObserverResult<TData, TError>> {
    // Make sure we reference the latest query as the current one might have been removed
    const query = this.buildQuery(this.options)

    if (query !== this.currentQuery) {
      this.currentQuery = query
      this.queryUpdateSubject.next({
        options: this.options,
        query
      })
    }

    /**
     * @important
     * we should fetch after we changed the query subject so current observer
     * still get a chance to retrieve the new query prefetch state
     */
    await query.fetch(this.options, fetchOptions)

    const { result } = this.getObserverResultFromQuery({
      query,
      options: this.options
    })

    return result
  }

  subscribe(listener: () => void) {
    void listener

    const sub = this.observe().result$.subscribe()

    return () => {
      sub.unsubscribe()
    }
  }

  observe() {
    const observedQuery = this.currentQuery

    // needs to be before the return of the first result.
    // whether the consumer subscribe or not
    // the function needs to run at least in the next tick (or its result)
    // to have a proper flow (see isFetchedAfterMount). We get inconsistencies
    // otherwise
    if (shouldFetchOnMount(observedQuery, this.options)) {
      this.fetch().catch(noop)
    }

    const query$ = this.queryUpdateSubject.pipe(
      map(({ query }) => query),
      distinctUntilChanged(),
      startWith(this.currentQuery)
    )

    const result$ = merge(
      this.queryUpdateSubject.pipe(
        startWith({
          query: this.currentQuery,
          options: this.options
        }),
        pairwise(),
        tap(
          ([
            { options: prevOptions, query: prevQuery },
            { options, query }
          ]) => {
            /**
             * @important
             * We monitor here the changes of options and query to eventually trigger
             * an automatic refetch. This is used after options have changed for example.
             * This is only valid if there is a subscriber
             */
            if (shouldFetchOptionally(query, prevQuery, options, prevOptions)) {
              this.fetch().catch(noop)
            }
          }
        ),
        ignoreElements()
      ),
      query$.pipe(
        switchMap((query) => {
          const options = this.options

          const observed$ = query.observe().pipe(share())

          const queryIsStale$ = observed$.pipe(
            filter((state) => state.status === "success"),
            switchMap((state) =>
              timer(this.options.staleTime ?? 1).pipe(map(() => state))
            )
          )

          // @todo move into its own operator
          const comparisonFunction = (
            objA: QueryObserverResult<TData, TError>,
            objB: QueryObserverResult<TData, TError>
          ) => {
            const notifyOnChangeProps = options.notifyOnChangeProps
            const notifyOnChangePropsValue =
              typeof notifyOnChangeProps === "function"
                ? notifyOnChangeProps()
                : notifyOnChangeProps

            const reducedFunction = Array.isArray(notifyOnChangePropsValue)
              ? notifyOnChangePropsValue.length === 0
                ? () => true
                : (
                    objA: QueryObserverResult<TData, TError>,
                    objB: QueryObserverResult<TData, TError>
                  ) => {
                    const reducedObjA = filterObjectByKey(
                      objA,
                      notifyOnChangePropsValue as any
                    )
                    const reducedObjB = filterObjectByKey(
                      objB,
                      notifyOnChangePropsValue as any
                    )

                    return shallowEqual(reducedObjA, reducedObjB)
                  }
              : shallowEqual

            return reducedFunction(objA, objB)
          }

          return merge(observed$, queryIsStale$).pipe(
            map(() => {
              const result = this.getObserverResultFromQuery({
                query,
                options
              })

              this.updateObservedResult({ query, ...result })

              return result.result
            }),
            // This one ensure we don't re-trigger same state
            distinctUntilChanged(shallowEqual),
            // This one make sure we dispatch based on user preference
            distinctUntilChanged(comparisonFunction)
          )
        })
      )
    ).pipe(trackSubscriptions((count) => (this.observers = count)))

    return { result$ }
  }

  destroy(): void {}
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
