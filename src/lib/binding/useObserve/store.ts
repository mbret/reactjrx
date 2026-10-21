import {
  BehaviorSubject,
  distinctUntilChanged,
  NEVER,
  type Observable,
  Subscription,
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
    source$: Observable<T> | undefined | (() => Observable<T> | undefined)
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

    /**
     * There is nothing to observe without a source. The state above is already
     * final (`complete`), which makes `subscribe` a no-op and therefore makes
     * `source$` unreachable. We skip building the pipe chain and opening a
     * subscription for a stream that can never emit.
     */
    if (hasNoDefinedSource) {
      this.source$ = NEVER
      this.sub = Subscription.EMPTY

      return
    }

    this.source$ = source$.pipe(
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
     *
     * An error is returned in the state, so it is handled here rather than
     * reported to RxJS as unhandled.
     */
    this.sub = this.source$.subscribe({ error: () => {} })
  }

  subscribe = (next: () => void) => {
    /**
     * The stream may already have completed or errored by the time React
     * subscribes. It won't emit again, and subscribing to the shared source
     * would only run it a second time.
     */
    if (this.state.observableState !== "live") {
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
