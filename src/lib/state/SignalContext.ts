import { BehaviorSubject } from "rxjs"
import { Signal, type VirtualSignal } from "./Signal"

export class SignalContext {
  /**
   * items only get added as they are created. The only time we should cleanup
   * are on context destroy. This is to ensure later re-use of virtual signals
   * return the same persisted state.
   */
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  signals = new BehaviorSubject(new Map<VirtualSignal<unknown>, Signal<any>>())

  public isDestroyed = false

  getOrCreateSignal<T>(virtualSignal: VirtualSignal<T>): Signal<T> {
    const existingSignal = this.signals.value.get(virtualSignal)

    if (existingSignal) {
      return existingSignal as Signal<T>
    }

    const newSignal = new Signal<T>({ ...virtualSignal.config, key: undefined })

    this.signals.value.set(virtualSignal, newSignal)
    this.signals.next(this.signals.value)

    return newSignal
  }

  destroy() {
    this.signals.value.forEach((signal) => {
      signal.complete()
    })
    this.signals.value.clear()
    this.signals.complete()
    this.isDestroyed = true
  }
}
