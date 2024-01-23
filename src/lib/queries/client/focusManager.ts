import { fromEvent, map, merge, shareReplay, startWith, tap } from "rxjs"

export class FocusManager {
  public readonly visibility$ = merge(
    fromEvent(document, "visibilitychange"),
    // does not exist on window but rq wrongly use it in their tests and code
    fromEvent(window, "visibilitychange")
  ).pipe(
    map(() => document.visibilityState),
    startWith(document.visibilityState),
    shareReplay(1)
  )

  #visibility = document.visibilityState

  constructor() {
    this.visibility$
      .pipe(
        tap((value) => {
          this.#visibility = value
        })
      )
      .subscribe()
  }

  isFocused() {
    return this.#visibility === "visible"
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
