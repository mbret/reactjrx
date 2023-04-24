import { BehaviorSubject, Observable, identity } from "rxjs"
import { trackSubscriptions } from "../utils/trackSubscriptions"
import { useObserve } from "../binding/useObserve"

type Option<T> = {
  default?: T
  scoped?: boolean
  key?: string
}

type Return<T> = [
  () => T,
  (stateOrUpdater: T | ((prev: T) => T)) => void,
  () => T,
  Observable<T>,
  Option<T>
]

export const signal = <T = undefined>(options: Option<T>): Return<T> => {
  const { default: defaultValue, scoped = false, key } = options
  const subject = new BehaviorSubject(defaultValue as T)
  const subject$ = subject.asObservable().pipe(
    scoped
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
    useObserve(subject$, { defaultValue: defaultValue as T, key })

  const setValue = <F extends (prev: T) => T>(arg: T | F) => {
    // prevent unnecessary state update if equals
    if (arg === subject.getValue()) return

    if (typeof arg === "function") {
      const change = (arg as F)(subject.getValue())

      if (change === subject.getValue()) return

      return subject.next(change)
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
    options
  ]
}
