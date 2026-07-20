import type { Signal, VirtualSignal } from "../Signal"
import { useSetSignal } from "./useSetSignal"
import { useSignalReference } from "./useSignalReference"
import { useSignalValue } from "./useSignalValue"

export function useSignal<T>(
  signal: VirtualSignal<T>,
): [T, Signal<T>["update"], Signal<T>]

export function useSignal<T>(
  signal: Signal<T>,
): [T, Signal<T>["update"], Signal<T>]

export function useSignal<T>(
  signal: Signal<T>,
): [T | undefined, Signal<T>["update"], Signal<T>]

export function useSignal<T>(signal: Signal<T> | VirtualSignal<T>) {
  const finalSignal = useSignalReference(signal)
  // Reuse the already-resolved signal so the value/setter hooks don't
  // re-resolve the (virtual) signal through the context on every render.
  const value = useSignalValue(finalSignal)
  const setValue = useSetSignal(finalSignal)

  return [value, setValue, finalSignal] as const
}
