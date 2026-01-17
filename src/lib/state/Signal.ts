import { BehaviorSubject } from "rxjs"
import { SIGNAL_RESET } from "./constants"

/**
 * Distributive helper to validate the shape of the updater function
 * and prevent covariance
 */
// biome-ignore lint/suspicious/noExplicitAny: Expected to prevent covariance
type ValidateShape<T, U> = T extends any
  ? U extends T
    ? U extends object
      ? { [K in keyof U]: K extends keyof T ? T[K] : never }
      : U
    : never
  : never

// biome-ignore lint/suspicious/noExplicitAny: TODO
export type SignalValue<T extends Signal<any, any>> = T["value"]

export type SignalWithKey<T> = Signal<T> & {
  key: string
}

export class Signal<
  T,
  K extends string | undefined = undefined,
> extends BehaviorSubject<T> {
  constructor(
    public config: {
      default: T
      key: K
    },
  ) {
    super(config.default)
  }

  update = <U>(
    valueOrUpdater:
      | ((prev: T) => U & ValidateShape<T, U>)
      // biome-ignore lint/complexity/noBannedTypes: TODO
      | (T extends Function ? never : T)
      | typeof SIGNAL_RESET,
  ): void => {
    if (valueOrUpdater === SIGNAL_RESET) {
      super.next(this.config.default)
    } else if (typeof valueOrUpdater === "function") {
      const updater = valueOrUpdater as (prev: T) => T

      super.next(updater(this.value))
    } else {
      super.next(valueOrUpdater as T)
    }
  }

  /**
   * @deprecated Use `next` instead
   */
  setValue = this.update.bind(this)

  /**
   * @deprecated Use `this` instead
   */
  get subject() {
    return this
  }

  get key() {
    return this.config.key
  }
}

export class VirtualSignal<T> {
  constructor(public config: { default: T }) {}
}
// biome-ignore lint/complexity/noBannedTypes: TODO
export function signal(config: {}): Signal<undefined, undefined>

export function signal<T = undefined, K extends string = string>(config: {
  key: K
}): Signal<T | undefined, K>

export function signal<T, K extends string = string>(config: {
  key: K
  default: T
}): Signal<T, K>

export function signal<T>(config: {
  key?: undefined
}): Signal<T | undefined, undefined>

export function signal<T>(config: {
  key?: undefined
  default: T
}): Signal<T, undefined>

export function signal<K extends string>(config: {
  key: K
  default?: undefined
}): Signal<undefined, K>

export function signal<T, K extends string | undefined = undefined>(
  config: { default?: T; key?: K } = {},
) {
  return new Signal({
    key: undefined,
    ...config,
    default: config.default ?? undefined,
  })
}

export function virtualSignal<T>(config: {
  default: T
  key?: string
}): VirtualSignal<T> {
  return new VirtualSignal(config)
}
