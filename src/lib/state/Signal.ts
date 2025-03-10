import { BehaviorSubject } from "rxjs"
import { SIGNAL_RESET } from "./constants"

export class Signal<T> extends BehaviorSubject<T> {
  constructor(
    public config: {
      default: T
      key?: string
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
}

export class VirtualSignal<T> {
  constructor(public config: { default: T; key?: string }) {}
}

export type SignalWithKey<T> = Signal<T> & {
  key: string
}

export function signal<T>(config?: { key?: string }): Signal<T | undefined>
export function signal<T>(config: { default: T; key?: string }): Signal<T>
export function signal<T>(config: { default?: T; key?: string } = {}) {
  return new Signal({ ...config, default: config.default ?? undefined })
}

export function virtualSignal<T>(config: {
  default: T
  key?: string
}): VirtualSignal<T> {
  return new VirtualSignal(config)
}
