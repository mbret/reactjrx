import {
  catchError,
  distinctUntilChanged,
  EMPTY,
  map,
  NEVER,
  type Observable,
  share,
  shareReplay,
  tap,
} from "rxjs"
import { filterObjectByKey } from "../../utils/filterObjectByKey"
import { makeObservable } from "../../utils/makeObservable"

export class ObservableStore<T> {
  state: {
    data: T | undefined
    status: "pending" | "success" | "error"
    observableState: "complete" | "error" | "live"
    error: Error | undefined
  } = {
    data: undefined,
    status: "pending",
    observableState: "live",
    error: undefined,
  }

  source$: Observable<T | undefined>

  constructor({
    source$: miscSource$,
    defaultValue,
    selectorKeys,
    compareFn,
  }: {
    source$: Observable<T> | (() => Observable<T> | undefined)
    defaultValue: T | undefined
    selectorKeys: (keyof T)[] | undefined
    compareFn: ((a: T, b: T) => boolean) | undefined
  }) {
    this.state.data = defaultValue

    const source$ =
      typeof miscSource$ === "function" ? miscSource$() : miscSource$

    console.log("source$", source$)

    if (source$ === undefined) {
      this.state = {
        ...this.state,
        status: "success",
        observableState: "complete",
      }
    }

    this.source$ = (source$ ?? NEVER).pipe(
      // Maybe selector
      map((v) => {
        if (selectorKeys && typeof v === "object" && v !== null) {
          return filterObjectByKey(v, selectorKeys) as T | undefined
        }

        return v
      }),
      // Maybe compareFn
      distinctUntilChanged((a, b) => {
        if (a === undefined || b === undefined) return false

        if (compareFn) {
          return compareFn(a as T, b as T)
        }

        return a === b
      }),
      tap({
        complete: () => {
          console.log("complete")

          this.state = {
            ...this.state,
            status: "success",
            observableState: "complete",
          }
        },
        error: (error) => {
          this.state = {
            ...this.state,
            observableState: "error",
            status: "error",
            error,
          }
        },
        next: (data) => {
          console.log("next", data)

          this.state = { ...this.state, data }
        },
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    )

    // to clean up
    this.source$.subscribe()
  }

  subscribe = (next: () => void) => {
    const sub = this.source$.subscribe({
      complete: next,
      error: next,
      next: next,
    })

    return () => {
      sub.unsubscribe()
    }
  }

  getSnapshot = (): typeof this.state => {
    // console.log("getSnapshot", this.state)

    return this.state
  }
}

export const storeMap = new Map<string, ObservableStore<unknown>>()
