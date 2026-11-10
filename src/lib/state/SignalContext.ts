import { Signal, type VirtualSignal } from "./Signal"

export class SignalContext {
  /**
   * Signals are only added, as they are created, so a virtual signal used
   * again in the same context gets the same signal and its state.
   */
  // biome-ignore lint/suspicious/noExplicitAny: each signal has the type of the virtual signal it is keyed by
  private readonly signals = new Map<VirtualSignal<unknown>, Signal<any>>()

  getOrCreateSignal<T>(virtualSignal: VirtualSignal<T>): Signal<T> {
    const existingSignal = this.signals.get(virtualSignal)

    if (existingSignal) {
      return existingSignal
    }

    const newSignal = new Signal<T>({
      default: virtualSignal.config.default,
      key: undefined,
    })

    this.signals.set(virtualSignal, newSignal)

    return newSignal
  }
}
