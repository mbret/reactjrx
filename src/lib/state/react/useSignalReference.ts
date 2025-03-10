import { type Signal, VirtualSignal } from "../Signal"
import {
  useMakeOrRetrieveSignal,
  useSignalContext,
} from "./SignalContextProvider"

export function useSignalReference<T>(
  signal: Signal<T> | VirtualSignal<T>,
): Signal<T> {
  const signalContext = useSignalContext()

  if (signal instanceof VirtualSignal && !signalContext) {
    throw new Error(
      "useSignalValue must be used within a SignalContextProvider",
    )
  }

  return (useMakeOrRetrieveSignal(
    signal instanceof VirtualSignal ? signal : undefined,
  ) ?? signal) as Signal<T>
}
