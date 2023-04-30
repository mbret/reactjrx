import { BehaviorSubject, Observable, identity } from "rxjs"
import { trackSubscriptions } from "../utils/trackSubscriptions"
import { useObserve } from "../binding/useObserve"
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

export type Signal<S> = {
  setState: SetState<S>
}

type Return<S, R> = [
  () => R,
  SetState<S>,
  () => R,
  Observable<R>,
  Option<S>,
  Signal<S>
]

// @todo turn into signal.$, signal.getValue, signal.setValue, signal.options, etc
// useSignal(signal)

export function signal<T = undefined>(options: Option<T>): Return<T, T>
export function signal<T = undefined>(options: Option<T>): Return<T, T> {
  // const { default: defaultValue, scoped = false, key } = options ?? {}
  const { default: defaultValue, key } = options ?? {}
  const subject = new BehaviorSubject(defaultValue as T)
  const subject$ = subject.asObservable().pipe(
    // scoped
    false
      ? trackSubscriptions((numberOfSubscriptions) => {
          if (
            numberOfSubscriptions < 1 &&
            subject.getValue() !== defaultValue
          ) {
            subject.next(defaultValue as T)
          }
        })
      : identity
  )

  const useValue = () =>
    useObserve(subject$, { defaultValue: subject.getValue(), key })

  const setValue = <F extends (prev: T) => T>(
    arg: T | F | typeof SIGNAL_RESET
  ) => {
    // prevent unnecessary state update if equals
    if (arg === subject.getValue()) return

    if (typeof arg === "function") {
      const change = (arg as F)(subject.getValue())

      if (change === subject.getValue()) return

      return subject.next(change)
    }

    if (arg === SIGNAL_RESET) {
      return subject.next((defaultValue ?? undefined) as T)
    }

    return subject.next(arg)
  }

  const getValue = () => subject.getValue()

  return [
    useValue,
    setValue,
    getValue,
    /**
     * @important
     * We return the original behavior subject for two reasons:
     * - useObserve may return the default value directly instead of undefined
     * - the scope exist for react binding, this observable is a direct access outside of it
     */
    subject,
    options,
    { setState: setValue }
  ]
}
