import { BehaviorSubject } from "rxjs"
import type { Observable } from "rxjs"
import { SIGNAL_RESET } from "./constants"

type Option<R = undefined> = {
  // scoped?: boolean
  key?: string
} & (R extends undefined
  ? {
      default?: R
    }
  : {
      default: R
    })

type SetState<S> = (
  stateOrUpdater: typeof SIGNAL_RESET | S | ((prev: S) => S)
) => void

export interface Signal<S, R> {
  setState: SetState<S>
  getValue: () => R
  options: Option<S>
  subject: Observable<S>
}

export function signal<T = undefined>(options: Option<T>): Signal<T, T>
export function signal<T = undefined>(options: Option<T>): Signal<T, T> {
  // const { default: defaultValue, scoped = false, key } = options ?? {}
  const { default: defaultValue } = options ?? {}
  const subject = new BehaviorSubject(defaultValue as T)
  // const subject$ = subject.asObservable()
  // .pipe(
  //   // scoped
  //   false
  //     ? trackSubscriptions((numberOfSubscriptions) => {
  //         if (
  //           numberOfSubscriptions < 1 &&
  //           subject.getValue() !== defaultValue
  //         ) {
  //           subject.next(defaultValue as T)
  //         }
  //       })
  //     : identity
  // )

  const setValue = <F extends (prev: T) => T>(
    arg: T | F | typeof SIGNAL_RESET
  ) => {
    // prevent unnecessary state update if equals
    if (arg === subject.getValue()) return

    if (typeof arg === "function") {
      const change = (arg as F)(subject.getValue())

      if (change === subject.getValue()) return

      subject.next(change)
      return
    }

    if (arg === SIGNAL_RESET) {
      subject.next((defaultValue ?? undefined) as T)
      return
    }

    subject.next(arg)
  }

  const getValue = () => subject.getValue()

  return {
    setState: setValue,
    getValue,
    options,
    /**
     * @important
     * We return the original behavior subject for two reasons:
     * - useObserve may return the default value directly instead of undefined
     * - the scope exist for react binding, this observable is a direct access outside of it
     */
    subject
  }
}
