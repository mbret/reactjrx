import type { Signal, VirtualSignal } from "../Signal.ts"
import { useSignalReference } from "./useSignalReference.ts"

export function useSetSignal<T>(signal: Signal<T>): Signal<T>["update"]
export function useSetSignal<T>(signal: VirtualSignal<T>): Signal<T>["update"]
export function useSetSignal<T>(signal: Signal<T> | VirtualSignal<T>) {
  const finalSignal = useSignalReference(signal)

  return finalSignal.update
}
