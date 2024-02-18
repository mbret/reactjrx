import {
  NEVER,
  type Observable,
  Subject,
  distinctUntilChanged,
  filter,
  ignoreElements,
  interval,
  map,
  merge,
  noop,
  pairwise,
  shareReplay,
  startWith,
  switchMap,
  takeWhile,
  tap,
  timer,
  withLatestFrom
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
  shouldFetchOnWindowFocus,
  shouldFetchOptionally
} from "./queryStateHelpers"
import { shallowEqual } from "../../../../utils/shallowEqual"
import { filterObjectByKey } from "../../../../utils/filterObjectByKey"
import { trackSubscriptions } from "../../../../utils/operators/trackSubscriptions"
import { replaceData } from "../utils"
import { takeUntilFinished } from "../query/operators"
import { focusManager } from "../../focusManager"

export interface ObserverFetchOptions extends FetchOptions {
  throwOnError?: boolean
}

export interface NotifyOptions {
  listeners?: boolean
}

interface LastResult<
  TQueryFnData,
  TError,
  TData,
  TQueryData,
  TQueryKey extends QueryKey = QueryKey
> {
  state: Query<TQueryFnData, TError, TQueryData, TQueryKey>["state"]
  result: QueryObserverResult<TData, TError>
  options: QueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >
  selectResult?: TData
  selectError?: null | TError
  select?:
    | QueryObserverOptions<
        TQueryFnData,
        TError,
        TData,
        TQueryData,
        TQueryKey
      >["select"]
    | null
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
    fetchOptions: ObserverFetchOptions
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
  readonly #lastResult: LastResult<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >

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
    this.#client = client
    this.bindMethods()
    this.options = this.#client.defaultQueryOptions(options)
    this.#currentQuery = this.buildQuery(this.options)
    const query = this.#currentQuery
    this.#currentQueryInitialState = query.state
    const { result, select } = this.getObserverResultFromQuery({
      query,
      options: this.options,
      prevResult: {
        options: this.options,
        state: query.state
      }
    })
    this.#lastResult = {
      state: query.state,
      options,
      result,
      select
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
    const prevOptions = this.options
    this.options = this.#client.defaultQueryOptions(options)

    if (!shallowEqual(this.options, prevOptions)) {
      this.#client.getQueryCache().notify({
        type: "observerOptionsUpdated",
        query: this.#currentQuery,
        observer: this
      })
    }

    const query = this.buildQuery(this.options)

    if (query !== this.#currentQuery) {
      this.#currentQueryInitialState = query.state
      this.#currentQuery = query
    }

    this.queryUpdateSubject.next({
      options: this.options,
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
      state: prevResultState,
      select: prevSelect,
      selectError: prevSelectError,
      selectResult: prevSelectResult
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
    prevResult: Partial<
      LastResult<TQueryFnData, TError, TData, TQueryData, TQueryKey>
    >
  }) => {
    const state = query.state
    const isPending = query.state.status === "pending"
    const prevQuery = this.#currentQuery
    const prevOptions = this.options
    const queryChange = query !== prevQuery
    const queryInitialState = queryChange
      ? query.state
      : this.#currentQueryInitialState
    let { errorUpdatedAt, fetchStatus, error } = state

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
    let data: TData | undefined

    let selectError = prevSelectError
    let selectFn = prevSelect ?? null
    let selectResult = prevSelectResult

    // Select data if needed
    if (options.select && typeof state.data !== "undefined") {
      // Memoize select result
      if (
        prevResult &&
        state.data === prevResultState?.data &&
        options.select === prevSelect
      ) {
        data = prevSelectResult
      } else {
        try {
          selectFn = options.select
          data = options.select(state.data)
          data = replaceData(prevResult?.data, data, options)
          selectResult = data
          selectError = null
        } catch (error) {
          data = prevSelectResult
          selectError = error as TError
        }
      }
    } else {
      data = state.data as TData | undefined
      selectError = null
    }

    let status =
      fetchStatus !== "idle" && !state.dataUpdatedAt ? "pending" : state.status

    if (selectError) {
      error = selectError
      data = prevSelectResult
      errorUpdatedAt = prevResult?.errorUpdatedAt ?? errorUpdatedAt
      status = "error"
    }

    const isError = status === "error"

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

    // const finalData = isSelected ? selectData : (data as TData)

    const isFetching = fetchStatus === "fetching"

    // console.log("queryObserver.getResult", {
    //   selectFn,
    //   selectError,
    //   select: options.select && typeof state.data !== "undefined",
    //   stateData: state.data,
    //   prevResultStateData: prevResultState?.data,
    //   sameSelect: options.select === prevSelect,
    //   usePreviousData:
    //     prevResult &&
    //     state.data === prevResultState?.data &&
    //     options.select === prevSelect
    // })

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = {
      status,
      fetchStatus,
      isPending,
      isSuccess: status === "success",
      isError,
      isInitialLoading: isLoading,
      isLoading,
      data,
      dataUpdatedAt: state.dataUpdatedAt,
      error,
      errorUpdatedAt,
      failureCount: state.fetchFailureCount,
      failureReason: state.fetchFailureReason,
      errorUpdateCount: state.errorUpdateCount,
      isFetched: state.dataUpdateCount > 0 || state.errorUpdateCount > 0,
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

    return {
      result,
      selectError,
      select: selectFn,
      selectResult
    } satisfies Pick<
      LastResult<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
      "select" | "selectError" | "result" | "selectResult"
    >
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
    // console.log("QueryObserver.getOptimisticResult")
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
    selectError,
    select,
    selectResult
  }: Pick<
    LastResult<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    "select" | "selectError" | "result" | "selectResult"
  > & {
    query: Query<TQueryFnData, TError, TQueryData, TQueryKey>
  }) {
    this.#lastResult.state = query.state
    this.#lastResult.result = result
    this.#lastResult.selectResult = selectResult
    if (selectError !== undefined) {
      this.#lastResult.selectError = selectError
    }
    if (select !== undefined) {
      this.#lastResult.select = select
    }
    this.#lastResult.options = this.options

    if (query.state.data !== undefined) {
      this.#lastQueryWithDefinedData = query
    }

    this.#client.getQueryCache().notify({
      query: this.#currentQuery,
      type: 'observerResultsUpdated',
    })
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

    const finalFetchOptions = {
      ...fetchOptions,
      cancelRefetch: fetchOptions?.cancelRefetch ?? true
    }

    this.#currentQuery.fetch(this.options, finalFetchOptions).catch(noop)

    // we should listen to query fetch event instead of this one, because
    // a fetch does not necessarily result in an actual fetch
    this.#fetchSubject.next({
      query,
      fetchOptions: finalFetchOptions
    })

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

    const observedQuery$ = currentQuery$.pipe(
      switchMap((query) => query.observe(this)),
      ignoreElements()
    )

    const result$ = merge(
      /**
       * It's important to observe the query before we subscribe to its result
       * later in the chain of merge to get the first result right after fetch
       */
      observedQuery$,
      watchForImplicitRefetch$,
      currentQuery$
        .pipe(
          switchMap((query) => {
            const options = this.options
            const options$ = this.queryUpdateSubject.pipe(
              startWith({ query, options }),
              filter((update) => update.query === query),
              map((update) => update.options),
              distinctUntilChanged(),
              shareReplay(1)
            )

            const queryFetch$ = this.#fetchSubject.pipe(
              filter((update) => update.query === query)
            )

            const currentQueryIsStale$ = query.state$.pipe(
              filter((state) => state.status === "success"),
              switchMap((state) =>
                this.options.staleTime === Infinity
                  ? NEVER
                  : timer(this.options.staleTime ?? 1).pipe(map(() => state))
              ),
              takeWhile(() => this.options.enabled ?? true)
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

            const refetchInterval$ = options$.pipe(
              switchMap(() => {
                const { refetchInterval, refetchIntervalInBackground } =
                  this.options
                const computedRefetchInterval =
                  (typeof refetchInterval === "function"
                    ? refetchInterval(this.#currentQuery)
                    : refetchInterval) ?? false

                return !computedRefetchInterval
                  ? NEVER
                  : interval(computedRefetchInterval).pipe(
                      tap(() => {
                        if (
                          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                          refetchIntervalInBackground ||
                          focusManager.isFocused()
                        ) {
                          this.fetch({ cancelRefetch: false }).catch(noop)
                        }
                      })
                    )
              }),
              ignoreElements()
            )

            const isMaybeEnabled$ = options$.pipe(
              map(({ enabled }) => enabled ?? true),
              distinctUntilChanged()
            )

            const disabled$ = isMaybeEnabled$.pipe(
              filter((enabled) => !enabled),
              map(() => query.state)
            )

            const onFocusRegain$ = isMaybeEnabled$.pipe(
              filter((enabled) => enabled),
              switchMap(() => focusManager.focusRegained$),
              withLatestFrom(options$),
              tap(([, options]) => {
                if (shouldFetchOnWindowFocus(query, options)) {
                  this.fetch({ cancelRefetch: false }).catch(noop)
                }
              }),
              ignoreElements()
            )

            const stateObservedOnDisabled$ = disabled$.pipe(
              map(() => query.state)
            )

            const updateResult = (
              source: Observable<any>
            ): Observable<QueryObserverResult<TData, TError>> => {
              return source.pipe(
                withLatestFrom(options$),
                map(([, currentOptions]) => {
                  const result = this.getObserverResultFromQuery({
                    query,
                    options: currentOptions,
                    prevResult: this.#lastResult
                  })

                  this.updateResult({ query, ...result })

                  return result.result
                })
              )
            }

            const stateUpdate$ = merge(
              stateObservedOnDisabled$,
              queryInternallyFetchedUpdate$,
              query.state$,
              // options$,
              currentQueryIsStale$
            )

            const observedResult$ = stateUpdate$.pipe(
              updateResult,
              // This one ensure we don't re-trigger same state
              distinctUntilChanged(shallowEqual),
              // This one make sure we dispatch based on user preference
              distinctUntilChanged(comparisonFunction)
            )

            return merge(refetchInterval$, onFocusRegain$, observedResult$)
          })
        )
        .pipe(
          trackSubscriptions((count) => (this.#observers = count)),
          tap({
            unsubscribe: () => {
              console.log("QueryObserver.observe.unsubscribe")
            },
            subscribe: () => {
              console.log("QueryObserver.observe.subscribe")
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
