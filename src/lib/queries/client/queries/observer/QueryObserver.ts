import {
  NEVER,
  Subject,
  delay,
  distinctUntilChanged,
  filter,
  ignoreElements,
  map,
  merge,
  noop,
  pairwise,
  shareReplay,
  startWith,
  switchMap,
  takeWhile,
  tap,
  timer
} from "rxjs"
import { type QueryClient } from "../../QueryClient"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { type Query } from "../query/Query"
import { type FetchOptions } from "../query/types"
import { type PlaceholderDataFunction, type RefetchOptions } from "../types"
import {
  type QueryObserverResult,
  type QueryObserverOptions,
  type DefaultedQueryObserverOptions
} from "./types"
import {
  canFetch,
  isStale,
  shouldFetchOnMount,
  shouldFetchOptionally
} from "./queryStateHelpers"
import { shallowEqual } from "../../../../utils/shallowEqual"
import { filterObjectByKey } from "../../../../utils/filterObjectByKey"
import { trackSubscriptions } from "../../../../utils/operators/trackSubscriptions"
import { replaceData } from "../utils"
import { takeUntilFinished } from "../query/operators"

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

  readonly #fetchSubject = new Subject<{
    query: Query<TQueryFnData, TError, TQueryData, TQueryKey>
    options: ObserverFetchOptions
  }>()

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
  #currentQueryInitialState: Query<
    TQueryFnData,
    TError,
    TQueryData,
    TQueryKey
  >["state"]

  /**
   * Mostly used for internal optimization such as not
   * running selectors twice, etc
   */
  readonly #lastResult: {
    state: Query<TQueryFnData, TError, TQueryData, TQueryKey>["state"]
    result: QueryObserverResult<TData, TError>
    options: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
    selectError?: null | TError
  }

  // This property keeps track of the last query with defined data.
  // It will be used to pass the previous data and query to the placeholder function between renders.
  #lastQueryWithDefinedData?: Query<TQueryFnData, TError, TQueryData, TQueryKey>

  #observers = 0

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
    console.log("QueryObserver.new")
    this.#client = client
    this.bindMethods()
    this.options = this.#client.defaultQueryOptions(options)
    this.#currentQuery = this.buildQuery(this.options)
    const query = this.#currentQuery
    this.#currentQueryInitialState = query.state
    this.#lastResult = {
      state: query.state,
      options,
      result: this.getObserverResultFromQuery({
        query,
        options: this.options,
        prevResult: {
          options: this.options,
          state: query.state
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
    >
  ) {
    const newOptions = this.#client.defaultQueryOptions(options)

    this.options = newOptions
    const query = this.buildQuery(this.options)

    if (query !== this.#currentQuery) {
      this.#currentQueryInitialState = query.state
      this.#currentQuery = query
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
    optimisticResult,
    prevResult: {
      result: prevResult,
      options: prevResultOptions,
      state: prevResultState
    }
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
    prevResult: {
      state: Query<TQueryFnData, TError, TQueryData, TQueryKey>["state"]
      result?: QueryObserverResult<TData, TError>
      options: QueryObserverOptions<
        TQueryFnData,
        TError,
        TData,
        TQueryData,
        TQueryKey
      >
    }
  }): { result: QueryObserverResult<TData, TError>; selectError?: TError } => {
    const state = query.state
    const isPending = query.state.status === "pending"
    const isError = query.state.status === "error"
    const prevQuery = this.#currentQuery
    const prevOptions = this.options
    const queryChange = query !== prevQuery
    const queryInitialState = queryChange
      ? query.state
      : this.#currentQueryInitialState

    let fetchStatus = query.state.fetchStatus

    if (optimisticResult) {
      const mounted = !!this.#observers

      const fetchOnMount = !mounted && shouldFetchOnMount(query, options)

      const fetchOptionally =
        mounted && shouldFetchOptionally(query, prevQuery, options, prevOptions)

      if (fetchOnMount || fetchOptionally) {
        fetchStatus = canFetch(query.options.networkMode)
          ? "fetching"
          : "paused"
      }
    }

    const isLoading = isPending && fetchStatus === "fetching"
    let data = state.data as TData | undefined

    const getSelectedValue = (): {
      data?: TData
      error?: TError
      isSelected?: boolean
    } => {
      try {
        const selectFn = options.select

        if (selectFn && typeof state.data !== "undefined") {
          const lastObservedResultSelectedData = prevResult?.data

          if (
            prevResultState.data === data &&
            lastObservedResultSelectedData !== undefined
          ) {
            if (this.#lastResult.selectError) {
              return { error: this.#lastResult.selectError }
            }

            return { data: lastObservedResultSelectedData, isSelected: true }
          }

          return { data: selectFn(state.data), isSelected: true }
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

    let status = selectError
      ? "error"
      : fetchStatus !== "idle" && !state.dataUpdatedAt
        ? "pending"
        : state.status

    let isPlaceholderData = false

    // Show placeholder data if needed
    if (
      typeof options.placeholderData !== "undefined" &&
      typeof data === "undefined" &&
      status === "pending"
    ) {
      let placeholderData

      // Memoize placeholder data
      if (
        prevResult?.isPlaceholderData &&
        options.placeholderData === prevResultOptions?.placeholderData
      ) {
        placeholderData = prevResult.data
      } else {
        placeholderData =
          typeof options.placeholderData === "function"
            ? (
                options.placeholderData as unknown as PlaceholderDataFunction<TQueryData>
              )(
                this.#lastQueryWithDefinedData?.state.data,
                this.#lastQueryWithDefinedData as Query<any, any, any, any>
              )
            : options.placeholderData
        if (options.select && typeof placeholderData !== "undefined") {
          try {
            placeholderData = options.select(placeholderData)
            // this.#selectError = null
          } catch (selectError) {
            // this.#selectError = selectError as TError
          }
        }
      }

      if (typeof placeholderData !== "undefined") {
        status = "success"
        data = replaceData(
          prevResult?.data,
          placeholderData as unknown,
          options
        ) as TData
        isPlaceholderData = true
      }
    }

    const finalData = isSelected ? selectData : (data as TData)

    const isFetching = fetchStatus === "fetching"

    console.log(
      "queryObserver.getResult",
      state.dataUpdateCount,
      queryInitialState.dataUpdateCount
    )

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = {
      status,
      fetchStatus,
      isPending,
      isSuccess: status === "success",
      isError,
      isInitialLoading: isLoading,
      isLoading,
      data: finalData,
      dataUpdatedAt: query.state.dataUpdatedAt,
      error: selectError ?? query.state.error,
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
      isRefetching: isFetching && !isPending,
      isLoadingError: isError && state.dataUpdatedAt === 0,
      isPaused: fetchStatus === "paused",
      isPlaceholderData,
      isRefetchError: isError && state.dataUpdatedAt !== 0,
      isStale: isStale(query, options),
      refetch: this.refetch
    } as QueryObserverResult<TData, TError>

    // console.log("QueryObserver.result", { result })

    return {
      result,
      selectError
    }
  }

  getCurrentResult(): QueryObserverResult<TData, TError> {
    return this.#lastResult.result
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
    console.log("QueryObserver.getOptimisticResult")
    const query = this.buildQuery(options)

    const observedResult = this.getObserverResultFromQuery({
      query,
      options,
      optimisticResult: true,
      prevResult: this.#lastResult
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
      this.updateResult({ query, ...observedResult })
    }

    return observedResult.result
  }

  protected updateResult({
    query,
    result,
    selectError
  }: {
    query: Query<TQueryFnData, TError, TQueryData, TQueryKey>
    result: QueryObserverResult<TData, TError>
    selectError?: TError
  }) {
    this.#lastResult.state = query.state
    this.#lastResult.result = result
    this.#lastResult.selectError = selectError
    this.#lastResult.options = this.options

    if (query.state.data !== undefined) {
      this.#lastQueryWithDefinedData = query
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
    console.log("fetch")
    // Make sure we reference the latest query as the current one might have been removed
    const query = this.buildQuery(this.options)

    if (query !== this.#currentQuery) {
      this.#currentQuery = query
      this.#currentQueryInitialState = query.state
      this.queryUpdateSubject.next({
        options: this.options,
        query
      })
    }

    this.#currentQuery.fetch(this.options, fetchOptions).catch(noop)

    this.#fetchSubject.next({ query, options: fetchOptions ?? {} })

    await query.getFetchResultAsPromise()

    // @todo we can optimize here and get current result if it exist
    const { result } = this.getObserverResultFromQuery({
      query,
      options: this.options,
      prevResult: this.#lastResult
    })

    return result
  }

  subscribe(listener: () => void) {
    void listener

    const sub = this.observe().subscribe()

    return () => {
      sub.unsubscribe()
    }
  }

  observe() {
    const observedQuery = this.#currentQuery

    const currentQuery$ = this.queryUpdateSubject.pipe(
      map(({ query }) => query),
      startWith(this.#currentQuery),
      distinctUntilChanged()
    )

    const watchForImplicitRefetch$ = this.queryUpdateSubject.pipe(
      startWith({
        query: this.#currentQuery,
        options: this.options
      }),
      pairwise(),
      tap(
        ([{ options: prevOptions, query: prevQuery }, { options, query }]) => {
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
    )

    const result$ = merge(
      watchForImplicitRefetch$,
      // watchForExplicitRefetch$,
      currentQuery$.pipe(
        switchMap((query) => {
          console.log("new query")
          const options = this.options
          const options$ = this.queryUpdateSubject.pipe(
            startWith({ query, options }),
            filter((update) => update.query === query),
            map((update) => update.options),
            distinctUntilChanged(),
            shareReplay(1)
          )

          const queryFetch$ = this.#fetchSubject.pipe(
            filter((update) => update.query === query),
            // delay(100)
          )

          const currentQueryIsStale$ = query.state$.pipe(
            filter((state) => state.status === "success"),
            switchMap((state) =>
              this.options.staleTime === Infinity
                ? NEVER
                : timer(this.options.staleTime ?? 1).pipe(map(() => state))
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

          const queryInternallyFetchedUpdate$ = queryFetch$.pipe(
            switchMap(() => query.state$),
            takeUntilFinished
          )

          const isMaybeEnabled$ = options$.pipe(
            map(({ enabled }) => enabled ?? true),
            distinctUntilChanged(),
            tap((value) => {})
          )

          const disabled$ = isMaybeEnabled$.pipe(
            filter((enabled) => !enabled),
            map(() => query.state)
          )

          const observedState$ = query.observe(this)

          const stateObservedOnDisabled$ = disabled$.pipe(
            map(() => query.state)
          )

          const updateResult = () => {
            console.log("update result")
            const result = this.getObserverResultFromQuery({
              query,
              options,
              prevResult: this.#lastResult
            })

            this.updateResult({ query, ...result })

            return result.result
          }

          const allObservedState$ = merge(
            stateObservedOnDisabled$,
            queryInternallyFetchedUpdate$,
            observedState$
          ).pipe(
            map(updateResult),
            tap((r) => {
              // console.log("QueryObserver.observe.result", r)
            })
          )

          const stateUpdate$ = merge(
            allObservedState$,
            currentQueryIsStale$.pipe(
              map(updateResult),
              takeWhile(() => this.options.enabled ?? true)
            )
          )

          const observedResult$ = stateUpdate$.pipe(
            // This one ensure we don't re-trigger same state
            distinctUntilChanged(shallowEqual),
            // This one make sure we dispatch based on user preference
            distinctUntilChanged(comparisonFunction)
          )

          return observedResult$
        })
      )
    ).pipe(
      trackSubscriptions((count) => (this.#observers = count)),
      tap({
        unsubscribe: () => {
          console.log("QueryObserver.observe.unsubscribe")
        },
        subscribe: () => {
          // needs to be before the return of the first result.
          // whether the consumer subscribe or not
          // the function needs to run at least in the next tick (or its result)
          // to have a proper flow (see isFetchedAfterMount). We get inconsistencies
          // otherwise
          if (shouldFetchOnMount(observedQuery, this.options)) {
            this.fetch().catch(noop)
          }
        }
      })
    )

    return result$
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
