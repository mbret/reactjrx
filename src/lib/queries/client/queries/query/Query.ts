import {
  type Observable,
  Subject,
  mergeMap,
  shareReplay,
  map,
  filter,
  scan,
  takeWhile,
  tap,
  takeUntil,
  merge,
  last
} from "rxjs"
import { isServer } from "../../../../utils/isServer"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { type QueryCache } from "../cache/QueryCache"
import { type QueryOptions } from "../types"
import { timeUntilStale } from "../utils"
import { getDefaultState } from "./getDefaultState"
import { type FetchOptions, type QueryState } from "./types"
import { executeQuery } from "./executeQuery"
import { type CancelOptions } from "../retryer/types"
import { CancelledError } from "../retryer/CancelledError"

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
  protected resetSubject = new Subject<void>()
  protected destroySubject = new Subject<void>()
  protected state$: Observable<typeof this.state>

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
      this.resetSubject.pipe(map(() => this.#initialState)),
      this.cancelSubject.pipe(
        filter(
          () => this.state.status !== "success" && this.state.status !== "error"
        ),
        map(
          () =>
            ({
              status: "error",
              error: new CancelledError() as TError
            }) satisfies Partial<typeof this.state>
        )
      ),
      this.executeSubject.pipe(
        mergeMap(() =>
          executeQuery(this.options).pipe(takeUntil(this.cancelSubject))
        ),
        takeUntil(this.resetSubject)
      )
    ).pipe(
      tap((t) => {
        console.log("RESULT", t)
      }),
      scan((acc, current) => {
        return {
          ...acc,
          ...current
        }
      }, this.state),
      tap((state) => {
        this.state = state
      }),
      takeUntil(this.destroySubject),
      shareReplay({ bufferSize: 1, refCount: false })
    )

    // @todo maybe remove
    this.state$.subscribe()
  }

  #setOptions(options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
    this.options = { ...this.#defaultOptions, ...options }

    this.updateGcTime(this.options.gcTime)

    return this.options
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
          takeWhile(
            (result) =>
              result.status !== "error" && result.status !== "success",
            true
          ),
          last()
        )
        .subscribe({
          error: (error) => {
            console.log("ERROR", error)
            reject(error)
          },
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

  foo() {}
}
