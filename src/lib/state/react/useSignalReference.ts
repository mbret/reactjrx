import { type Signal, VirtualSignal } from "../Signal"
import { useSignalContext } from "./SignalContextProvider"

export function useSignalReference<T>(
  signal: Signal<T> | VirtualSignal<T>,
): Signal<T> {
  const signalContext = useSignalContext()

  if (signal instanceof VirtualSignal && !signalContext) {
    throw new Error(
      "useSignalValue must be used within a SignalContextProvider",
    )
  }

  return (
    signal instanceof VirtualSignal
      ? signalContext.getOrCreateSignal(signal)
      : signal
  ) as Signal<T>
}
