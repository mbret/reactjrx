import { useContext } from "react"
import { type Signal, VirtualSignal } from "../Signal.ts"
import { SignalReactContext } from "./SignalReactContext.ts"

/**
 * The signal itself, or the signal that the SignalContextProvider above holds
 * for a virtual signal. Throws for a virtual signal outside a provider.
 */
export function useSignalReference<T>(
  signal: Signal<T> | VirtualSignal<T>,
): Signal<T> {
  const signalContext = useContext(SignalReactContext)

  if (!(signal instanceof VirtualSignal)) return signal

  if (!signalContext) {
    throw new Error(
      "A virtual signal must be used within a SignalContextProvider",
    )
  }

  return signalContext.getOrCreateSignal(signal)
}
