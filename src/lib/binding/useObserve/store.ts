import {
  BehaviorSubject,
  distinctUntilChanged,
  NEVER,
  type Observable,
  type Subscription,
  share,
  tap,
} from "rxjs"

export type State<T, DefaultValue, Error = unknown> = {
  data: T | DefaultValue
  status: "pending" | "success" | "error"
  observableState: "complete" | "error" | "live"
  error: Error | undefined
}

export interface ObservableStoreOptions<T, DefaultValue> {
  defaultValue: DefaultValue
  compareFn: ((a: T, b: T) => boolean) | undefined
}

export class ObservableStore<T, DefaultValue, Error = unknown> {
  state: State<T, DefaultValue, Error>
  source$: Observable<T | undefined>
  sub: Subscription

  constructor({
    source$: miscSource$,
    defaultValue,
    compareFn,
  }: {
    source$: Observable<T> | (() => Observable<T> | undefined)
  } & ObservableStoreOptions<T, DefaultValue>) {
    const source$ =
      typeof miscSource$ === "function" ? miscSource$() : miscSource$

    const hasNoDefinedSource = source$ === undefined

    this.state = {
      data: source$ instanceof BehaviorSubject ? source$.value : defaultValue,
      status: hasNoDefinedSource ? "success" : "pending",
      observableState: hasNoDefinedSource ? "complete" : "live",
      error: undefined,
    }

    this.source$ = (source$ ?? NEVER).pipe(
      distinctUntilChanged(compareFn),
      tap({
        complete: () => {
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
          this.state = { ...this.state, data }
        },
      }),
      share(),
    )

    /**
     * @important This eager subscription will optimistically update the state.
     * Any observable that is non async (behavior, of(x), etc) will have in fact their state completed
     * by the first render cycle.
     * Although we only correctly type sync state for `BehaviorSubject` we can in fact get the value in sync
     * for more than them.
     * Technically the whole pipe chain runs "synchronously".
     *
     * This is not a guarantee, just that in best case scenario there will be only one render.
     */
    this.sub = this.source$.subscribe()
  }

  subscribe = (next: () => void) => {
    // in some case the observable is already complete by the time we subscribe to it.
    if (this.state.observableState === "complete") {
      return () => {}
    }

    const sub = this.source$.subscribe({
      complete: next,
      error: next,
      next: next,
    })

    return () => {
      sub.unsubscribe()
    }
  }

  getSnapshot = () => {
    return this.state
  }
}
