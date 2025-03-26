import { BehaviorSubject } from "rxjs"
import { SIGNAL_RESET } from "./constants"

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
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

  update = <U extends T>(
    valueOrUpdater:
      | ((prev: T) => T)
      // biome-ignore lint/complexity/noBannedTypes: <explanation>
      | (U extends Function ? never : U)
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

export function signal<T, K extends string = string>(config: {
  key: K
  default: T
}): Signal<T, K>

export function signal<T>(config: {
  key?: undefined
  default: T
}): Signal<T, undefined>

export function signal<K extends string>(config: {
  key: K
  default?: undefined
}): Signal<undefined, K>

export function signal<T>(config?: {
  key?: undefined
  default?: T
}): Signal<T, undefined>

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
