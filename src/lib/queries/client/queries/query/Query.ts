import {
  type Observable,
  Subject,
  mergeMap,
  shareReplay,
  map,
  filter,
  takeWhile,
  tap,
  takeUntil,
  merge,
  last,
  finalize,
  BehaviorSubject,
  startWith,
  catchError,
  EMPTY
} from "rxjs"
import { isServer } from "../../../../utils/isServer"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { type QueryCache } from "../cache/QueryCache"
import { type SetDataOptions, type QueryOptions } from "../types"
import { replaceData, timeUntilStale } from "../utils"
import { getDefaultState } from "./getDefaultState"
import { type QueryMeta, type FetchOptions, type QueryState } from "./types"
import { executeQuery } from "./executeQuery"
import { type CancelOptions } from "../retryer/types"
import { CancelledError } from "../retryer/CancelledError"
import { mergeResults } from "./operators"
import { trackSubscriptions } from "../../../../utils/operators/trackSubscriptions"

interface QueryConfig<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey = QueryKey
> {
  cache: QueryCache
  queryKey: TQueryKey
  queryHash: string
  options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
  defaultOptions?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
  state?: QueryState<TData, TError>
}

export class Query<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> {
  public queryKey: TQueryKey
  public queryHash: string
  gcTime: number
  options: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
  readonly #defaultOptions?: QueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey
  >

  readonly #initialState: QueryState<TData, TError>
  state: QueryState<TData, TError>

  // @todo to share with mutation
  protected executeSubject = new Subject<void>()
  protected cancelSubject = new Subject<void>()
  protected setDataSubject = new Subject<{
    data: TData
    options?: SetDataOptions & { manual: boolean }
  }>()

  protected invalidatedSubject = new Subject<void>()
  protected resetSubject = new Subject<void>()
  protected destroySubject = new Subject<void>()
  protected observerCount = new BehaviorSubject(0)
  protected observedState$: Observable<typeof this.state>

  public observerCount$ = this.observerCount.asObservable()
  public state$: Observable<typeof this.state>

  constructor(config: QueryConfig<TQueryFnData, TError, TData, TQueryKey>) {
    // this.#abortSignalConsumed = false
    this.#defaultOptions = config.defaultOptions
    this.options = this.#setOptions(config.options)
    // this.#observers = []
    // this.#cache = config.cache
    this.queryKey = config.queryKey
    this.queryHash = config.queryHash
    this.#initialState = config.state ?? getDefaultState(this.options)
    this.state = this.#initialState
    this.gcTime = this.updateGcTime(this.options.gcTime)

    this.state$ = merge(
      this.invalidatedSubject.pipe(
        map(
          () =>
            ({
              isInvalidated: true
            }) satisfies Partial<QueryState<TData, TError>>
        )
      ),
      this.resetSubject.pipe(map(() => this.#initialState)),
      this.cancelSubject.pipe(
        filter(
          () => this.state.status !== "success" && this.state.status !== "error"
        ),
        map(
          () =>
            ({
              status: "error",
              fetchStatus: "idle",
              error: new CancelledError() as TError
            }) satisfies Partial<typeof this.state>
        )
      ),
      this.executeSubject.pipe(
        mergeMap(() =>
          executeQuery({ ...this.options, queryKey: this.queryKey }).pipe(
            tap((t) => {
              // console.log("executeSubject", t)
            }),
            finalize(() => {
              // console.log("executeSubject FINALIZE")
            }),
            takeUntil(this.cancelSubject)
          )
        ),
        takeUntil(this.resetSubject)
      ),
      this.setDataSubject.pipe(
        map(
          ({ data, options }) =>
            ({
              status: "success",
              data,
              dataUpdatedAt:
                options?.updatedAt !== undefined
                  ? options.updatedAt
                  : new Date().getTime()
            }) satisfies Partial<QueryState<TData, TError>>
        )
      )
    ).pipe(
      startWith(this.#initialState),
      mergeResults({
        initialState: this.state,
        getOptions: () => this.options,
        getState: () => this.state
      }),
      tap((state) => {
        this.state = state
      }),
      tap((state) => {
        console.log("Query state", state)
      }),
      catchError((error) => {
        console.error(error)

        return EMPTY
      }),
      takeUntil(this.destroySubject),
      shareReplay({ bufferSize: 1, refCount: false })
    )

    this.observedState$ = this.state$.pipe(
      trackSubscriptions((count) => {
        this.observerCount.next(count)
      })
    )
  }

  #setOptions(options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
    this.options = { ...this.#defaultOptions, ...options }

    this.updateGcTime(this.options.gcTime)

    return this.options
  }

  get meta(): QueryMeta | undefined {
    return this.options.meta
  }

  observe() {
    return this.observedState$
  }

  getObserversCount() {
    return this.observerCount.getValue()
  }

  protected updateGcTime(newGcTime: number | undefined) {
    // Default to 5 minutes (Infinity for server-side) if no gcTime is set
    this.gcTime = Math.max(
      this.gcTime || 0,
      newGcTime ?? (isServer ? Infinity : 5 * 60 * 1000)
    )

    return this.gcTime
  }

  isActive(): boolean {
    // return this.#observers.some(
    //   (observer) => observer.options.enabled !== false
    // )
    return false
  }

  isDisabled(): boolean {
    // return this.getObserversCount() > 0 && !this.isActive()
    return false
  }

  isStale(): boolean {
    // return (
    //   this.state.isInvalidated ||
    //   !this.state.dataUpdatedAt ||
    //   this.#observers.some((observer) => observer.getCurrentResult().isStale)
    // )
    return false
  }

  isStaleByTime(staleTime = 0): boolean {
    return (
      this.state.isInvalidated ||
      !this.state.dataUpdatedAt ||
      !timeUntilStale(this.state.dataUpdatedAt, staleTime)
    )
  }

  getInitialState() {
    return this.#initialState
  }

  async fetch(
    options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    fetchOptions?: FetchOptions
  ): Promise<TData> {
    // Update config if passed, otherwise the config from the last execution is used
    if (options) {
      this.#setOptions(options)
    }

    this.executeSubject.next()

    return await new Promise<TData>((resolve, reject) => {
      this.state$
        .pipe(
          takeWhile((result) => {
            const isSuccessOrError =
              result.status === "error" || result.status === "success"
            const isFetchingOrPaused = result.fetchStatus !== "idle"

            void isSuccessOrError

            return isFetchingOrPaused
          }, true),
          last()
        )
        .subscribe({
          error: reject,
          next: (data) => {
            // console.log("query fetch done", data)
            if (data.error) {
              reject(data.error)
            } else {
              resolve(data.data as TData)
            }
          }
        })
    })
  }

  setData(
    newData: TData,
    options?: SetDataOptions & { manual: boolean }
  ): TData {
    const data = replaceData(this.state.data, newData, this.options)

    this.setDataSubject.next({ data, options })

    return data
  }

  invalidate(): void {
    if (!this.state.isInvalidated) {
      this.invalidatedSubject.next()
    }
  }

  async cancel(options?: CancelOptions): Promise<void> {
    this.cancelSubject.next()
    // const promise = this.#promise
    // this.#retryer?.cancel(options)
    // return promise ? promise.then(noop).catch(noop) : Promise.resolve()
  }

  // @todo merge with query
  destroy() {
    this.destroySubject.next()
    this.destroySubject.complete()
    this.executeSubject.complete()
  }

  // @todo merge with query
  reset() {
    this.resetSubject.next()
    this.resetSubject.complete()
    this.destroy()
  }
}
