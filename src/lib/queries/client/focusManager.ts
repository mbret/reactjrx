import {
  filter,
  fromEvent,
  map,
  merge,
  skip,
  tap,
  BehaviorSubject,
  EMPTY
} from "rxjs"
import { isServer } from "../../utils"

export class FocusManager {
  readonly #visibility$ = merge(
    fromEvent(document, "visibilitychange"),
    isServer ? EMPTY : fromEvent(window, "visibilitychange")
  ).pipe(map(() => document.visibilityState))

  readonly #focusedSubject = new BehaviorSubject(
    document.visibilityState === "visible"
  )

  // public readonly focused$ = this.#focusedSubject.pipe(distinctUntilChanged())
  public readonly focused$ = this.#focusedSubject
  public readonly focusRegained$ = this.focused$.pipe(
    skip(1),
    filter((visibility) => visibility)
  )

  constructor() {
    this.#visibility$
      .pipe(
        tap((value) => {
          this.#focusedSubject.next(value === "visible")
        })
      )
      .subscribe()
  }

  isFocused() {
    return this.#focusedSubject.getValue()
  }

  setFocused(focused?: boolean): void {
    const changed = this.#focusedSubject.getValue() !== (focused ?? true)
    if (changed) {
      this.#focusedSubject.next(focused ?? true)
    }
  }

  subscribe(fn: () => void) {
    const sub = this.focused$.subscribe(fn)

    return () => {
      sub.unsubscribe()
    }
  }

  /**
   * @important
   * You do not need that outside of testing. This is bad practice but necessary in order
   * to not mess too much with rq tests files.
   *
   * Use it after mocking to force the manager to hold mocked value.
   */
  refresh() {
    document.dispatchEvent(new Event("visibilitychange"))
  }
}

export const focusManager = new FocusManager()
