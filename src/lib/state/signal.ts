import { BehaviorSubject, first, skip } from "rxjs"
import type { Observable } from "rxjs"
import { SIGNAL_RESET } from "./constants"

type setValue<S> = (
  stateOrUpdater: typeof SIGNAL_RESET | S | ((prev: S) => S)
) => void

type Getter<Value> = (
  get: <GetSignal extends Signal<any, any, any>>(
    signal: GetSignal
  ) => ReturnType<GetSignal["getValue"]>
) => Value

export type Config<
  DefaultValue = undefined,
  Key = undefined
> = Key extends undefined
  ? {
      default: DefaultValue
    }
  : {
      default: DefaultValue
      key: Key
    }

interface ReadOnlySignalConfig<Value> {
  get: Getter<Value>
}

export interface ReadOnlySignal<Value> {
  getValue: () => Value
  config: ReadOnlySignalConfig<Value>
  subject: Observable<Value>
}

export interface Signal<
  DefaultValue = undefined,
  Value = undefined,
  Key = undefined
> {
  setValue: setValue<DefaultValue>
  getValue: () => Value
  config: Config<DefaultValue, Key>
  subject: Observable<DefaultValue>
}

export function signal<T = undefined, V = T>(
  config?: Omit<Partial<Config<T, string | undefined>>, "key" | "get">
): Signal<T, V, undefined>

export function signal<T = undefined, V = T>(
  config: Omit<Partial<Config<T, string | undefined>>, "get"> & {
    key: string
  }
): Signal<T, V, string>

export function signal<V = undefined>(
  config: ReadOnlySignalConfig<V>
): ReadOnlySignal<V>

export function signal<
  T = undefined,
  V = undefined,
  Key extends string | undefined = undefined
>(
  config: Partial<Config<T, Key>> | ReadOnlySignalConfig<V> = {}
): Signal<T, V, Key> | ReadOnlySignal<V> {
  const normalizedConfig: Config<T | undefined, string | undefined> = {
    default: (config as any).default,
    key: (config as any).key
  }
  const { default: defaultValue } = normalizedConfig ?? {}
  const subject = new BehaviorSubject(defaultValue as any)

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

  /**
   * Read Only signals
   */
  if ("get" in config) {
    const getter = (signal: Signal<any, any, any>) => {
      signal.subject.pipe(skip(1), first()).subscribe(() => {
        const newValue = config.get?.(getter)

        setValue(newValue as any)
      })

      return signal.getValue()
    }

    const defaultValue = config.get(getter)

    setValue(defaultValue as any)

    return {
      getValue,
      config,
      subject
    }
  }

  return {
    setValue,
    getValue,
    config: normalizedConfig as any,
    subject
  }
}

export type SignalValue<S extends Signal<any, any, any>> = ReturnType<
  S["getValue"]
>
