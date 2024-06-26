import {
  type Observable,
  Subject,
  mergeMap,
  shareReplay,
  map,
  filter,
  tap,
  takeUntil,
  merge,
  last,
  BehaviorSubject,
  startWith,
  distinctUntilChanged,
  catchError,
  ignoreElements,
  pairwise
} from "rxjs"
import { isServer } from "../../../../utils/isServer"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { type QueryCache } from "../cache/QueryCache"
import { type SetDataOptions, type QueryOptions } from "../types"
import { replaceData, timeUntilStale } from "../utils"
import { getDefaultState } from "./getDefaultState"
import { type QueryMeta, type FetchOptions, type QueryState } from "./types"
import { executeQuery } from "./execution/executeQuery"
import { type CancelOptions } from "../retryer/types"
import { CancelledError } from "../retryer/CancelledError"
import { reduceState, takeUntilFinished } from "./operators"
import { shallowEqual } from "../../../../utils/shallowEqual"
import { type QueryObserver } from "../observer/QueryObserver"
import { Logger } from "../../../../logger"

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
  public gcTime: number
  public options: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
  readonly #defaultOptions?: QueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey
  >

  readonly #initialState: QueryState<TData, TError>
  state: QueryState<TData, TError>

  // @todo to share with mutation
  protected executeSubject = new Subject<FetchOptions | undefined>()
  protected cancelSubject = new Subject<CancelOptions | undefined>()
  protected setDataSubject = new Subject<{
    data: TData
    options?: SetDataOptions & { manual: boolean }
  }>()

  protected invalidatedSubject = new Subject<void>()
  protected resetSubject = new Subject<void>()
  protected destroySubject = new Subject<void>()
  protected observersSubject = new BehaviorSubject<QueryObserver[]>([])

  protected abortSignalConsumed = false
  public observerCount$ = this.observersSubject
    .asObservable()
    .pipe(map((observers) => observers.length))

  public observers$ = this.observersSubject.asObservable()
  public state$: Observable<typeof this.state>

  constructor(config: QueryConfig<TQueryFnData, TError, TData, TQueryKey>) {
    this.#defaultOptions = config.defaultOptions
    this.options = this.setOptions(config.options)
    this.queryKey = config.queryKey
    this.queryHash = config.queryHash
    this.#initialState = config.state ?? getDefaultState(this.options)
    this.state = this.#initialState
    this.gcTime = this.updateGcTime(this.options.gcTime)

    type State = typeof this.state
    type PartialState = Partial<State>

    this.state$ = merge(
      this.resetSubject.pipe(
        map(() => ({ command: "reset" as const, state: this.#initialState }))
      ),
      this.invalidatedSubject.pipe(
        filter(() => !this.state.isInvalidated),
        map((): { command: "invalidate"; state: PartialState } => ({
          command: "invalidate",
          state: {
            isInvalidated: true
          }
        }))
      ),
      this.cancelSubject.pipe(
        filter(() => {
          const isQueryOnError =
            this.state.error && this.state.status === "error"

          return !isQueryOnError
        }),
        map((options) => ({
          command: "cancel" as const,
          state: {
            status: options?.revert ? this.state.status : "error",
            fetchStatus: "idle",
            error: new CancelledError(options) as TError
          } satisfies PartialState
        }))
      ),
      this.executeSubject.pipe(
        mergeMap(() => {
          let noMoreObserversActive = false

          // @todo improve with a switchMap ?
          const cancelFromNewRefetch$ = this.executeSubject.pipe(
            // should not be needed since the fetch return current promise
            // in case we don't cancel
            filter((options) => options?.cancelRefetch !== false)
          )

          const detectNoMoreObserversActive$ = this.observers$.pipe(
            pairwise(),
            tap(([prevObservers, currentObservers]) => {
              if (currentObservers.length === 0 && prevObservers.length > 0) {
                noMoreObserversActive = true
              } else {
                noMoreObserversActive = false
              }
            }),
            ignoreElements()
          )

          const { state$: functionExecution$, abortController } = executeQuery({
            ...this.options,
            observers$: this.observerCount$,
            queryKey: this.queryKey,
            retry: (attempt, error) => {
              const retry = this.options.retry ?? true
              if (typeof retry === "function") return retry(attempt, error)
              if (typeof retry === "boolean") return retry

              return attempt < retry
            },
            retryAfterDelay: () => {
              if (noMoreObserversActive) return false

              return true
            },
            onSignalConsumed: () => {
              this.abortSignalConsumed = true
            }
          })

          const executionAbortedFromSignal$ = this.observerCount$.pipe(
            filter((count) => count === 0 && this.abortSignalConsumed),
            tap(() => {
              this.cancelSubject.next({ revert: true })
            })
          )

          const cancelExecution$ = merge(
            this.cancelSubject,
            cancelFromNewRefetch$,
            this.resetSubject,
            executionAbortedFromSignal$
          ).pipe(
            tap(() => {
              if (this.abortSignalConsumed) {
                abortController.abort()
              }
            })
          )

          return merge(functionExecution$, detectNoMoreObserversActive$).pipe(
            map((state) => ({
              command: "execute" as const,
              state
            })),
            takeUntil(cancelExecution$)
          )
        })
      ),
      this.setDataSubject.pipe(
        map(({ data, options }) => ({
          command: "setData" as const,
          state: {
            status: "success" as const,
            data,
            dataUpdatedAt:
              options?.updatedAt !== undefined
                ? options.updatedAt
                : new Date().getTime()
          } satisfies PartialState
        }))
      )
    ).pipe(
      reduceState({
        initialState: this.state,
        getOptions: () => this.options,
        getState: () => this.state
      }),
      startWith(this.#initialState),
      distinctUntilChanged(shallowEqual),
      tap((state) => {
        this.state = state
      }),
      catchError((e) => {
        Logger.error(e)

        throw e
      }),
      takeUntil(this.destroySubject),
      shareReplay({ bufferSize: 1, refCount: false })
    )
  }

  public setOptions(
    options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
  ) {
    this.options = { ...this.#defaultOptions, ...options }

    this.updateGcTime(this.options.gcTime)

    return this.options
  }

  get meta(): QueryMeta | undefined {
    return this.options.meta
  }

  get success$() {
    return this.state$.pipe(
      map(({ data, status }) => ({ data, status })),
      distinctUntilChanged(shallowEqual),
      filter(({ status }) => status === "success")
    )
  }

  get error$() {
    return this.state$.pipe(
      map(({ error, status }) => ({ error, status })),
      distinctUntilChanged(shallowEqual),
      filter(({ status }) => status === "error")
    )
  }

  get settled$() {
    return this.state$.pipe(
      map(({ status }) => ({ status })),
      distinctUntilChanged(shallowEqual),
      filter(({ status }) => status === "success" || status === "error")
    )
  }

  observe(observer: QueryObserver<any, any, any, any, any>) {
    const state$ = this.state$.pipe(
      tap({
        subscribe: () => {
          this.observersSubject.next([
            observer,
            ...this.observersSubject.getValue()
          ])
        },
        unsubscribe: () => {
          this.observersSubject.next(
            this.observersSubject.getValue().filter((item) => item !== observer)
          )
        }
      })
    )

    return state$
  }

  getObserversCount() {
    return this.observersSubject.getValue().length
  }

  // @todo this can be shared with mutation
  protected updateGcTime(newGcTime: number | undefined) {
    // Default to 5 minutes (Infinity for server-side) if no gcTime is set
    this.gcTime = Math.max(
      this.gcTime || 0,
      newGcTime ?? (isServer ? Infinity : 5 * 60 * 1000)
    )

    return this.gcTime
  }

  isActive() {
    return this.observersSubject
      .getValue()
      .some((observer) => observer.options.enabled !== false)
  }

  isDisabled(): boolean {
    return this.getObserversCount() > 0 && !this.isActive()
  }

  isStale(): boolean {
    return (
      this.state.isInvalidated ||
      !this.state.dataUpdatedAt ||
      this.observersSubject
        .getValue()
        .some((observer) => observer.getCurrentResult().isStale)
    )
  }

  isStaleByTime(staleTime = 0): boolean {
    return (
      this.state.isInvalidated ||
      !this.state.dataUpdatedAt ||
      !timeUntilStale(this.state.dataUpdatedAt, staleTime)
    )
  }

  async getFetchResultAsPromise() {
    return await new Promise<TData>((resolve, reject) => {
      this.state$.pipe(takeUntilFinished, last()).subscribe({
        error: reject,
        next: (data) => {
          if (data.error) {
            reject(data.error)
          } else {
            resolve(data.data as TData)
          }
        }
      })
    })
  }

  async fetch(
    options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    fetchOptions?: FetchOptions
  ): Promise<TData> {
    const { cancelRefetch } = fetchOptions ?? {}

    if (this.state.fetchStatus !== "idle") {
      const shouldCancelRequest = !!this.state.dataUpdatedAt && cancelRefetch

      if (!shouldCancelRequest) {
        // Return current promise if we are already fetching
        return await this.getFetchResultAsPromise()
      }
    }

    // Update config if passed, otherwise the config from the last execution is used
    if (options) {
      this.setOptions(options)
    }

    this.executeSubject.next(fetchOptions)

    return await this.getFetchResultAsPromise()
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
    this.invalidatedSubject.next()
  }

  async cancel(options?: CancelOptions): Promise<void> {
    this.cancelSubject.next(options)
  }

  // @todo merge with mutation
  destroy() {
    this.destroySubject.next()
    this.destroySubject.complete()
    this.executeSubject.complete()
  }

  // @todo merge with mutation
  reset() {
    this.resetSubject.next()
  }
}
