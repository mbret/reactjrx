import { BehaviorSubject } from "rxjs"
import type { Observable } from "rxjs"
import { SIGNAL_RESET } from "./constants"

type WithOptionalDefault<V> = V extends undefined
  ? {
      default?: V
    }
  : {
      default: V
    }

type WithOptionalKey<V> = V extends undefined
  ? {
      key?: V
    }
  : {
      key: V
    }

type Config<R = undefined, K = undefined> = WithOptionalKey<K> &
  WithOptionalDefault<R>

type setValue<S> = (
  stateOrUpdater: typeof SIGNAL_RESET | S | ((prev: S) => S)
) => void

export interface Signal<S = undefined, R = undefined, K = undefined> {
  setValue: setValue<S>
  getValue: () => R
  config: Config<S, K>
  subject: Observable<S>
}

export function signal<T = undefined>(
  config: Config<T, string>
): Signal<T, T, string>
export function signal<T = undefined>(
  config: Config<T, undefined>
): Signal<T, T>
export function signal<T = undefined>(
  config: Config<T, string | undefined>
): Signal<T, T, string | undefined> {
  const { default: defaultValue } = config ?? {}
  const subject = new BehaviorSubject(defaultValue as T)

  const setValue = <F extends (prev: T) => T>(
    arg: T | F | typeof SIGNAL_RESET
  ) => {
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
    setValue,
    getValue,
    config,
    subject
  }
}
