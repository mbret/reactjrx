import { type Signal, VirtualSignal } from "../Signal"
import {
  useMakeOrRetrieveSignal,
  useSignalContext,
} from "./SignalContextProvider"

export function useSetSignal<T>(signal: Signal<T>): Signal<T>["update"]
export function useSetSignal<T>(signal: VirtualSignal<T>): Signal<T>["update"]

export function useSetSignal<T>(signal: Signal<T> | VirtualSignal<T>) {
  const signalContext = useSignalContext()

  if (signal instanceof VirtualSignal && !signalContext) {
    throw new Error(
      "useSignalValue must be used within a SignalContextProvider",
    )
  }

  const finalSignal = (useMakeOrRetrieveSignal(
    signal instanceof VirtualSignal ? signal : undefined,
  ) ?? signal) as Signal<unknown>

  return finalSignal.update
}
