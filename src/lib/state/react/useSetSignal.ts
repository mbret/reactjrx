import type { Signal, VirtualSignal } from "../Signal"
import { useSignalReference } from "./useSignalReference"

export function useSetSignal<T>(signal: Signal<T>): Signal<T>["update"]
export function useSetSignal<T>(signal: VirtualSignal<T>): Signal<T>["update"]
export function useSetSignal<T>(signal: Signal<T> | VirtualSignal<T>) {
  const finalSignal = useSignalReference(signal)

  return finalSignal.update
}
