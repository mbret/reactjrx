import type { Signal, VirtualSignal } from "../Signal.ts"
import { useSetSignal } from "./useSetSignal.ts"
import { useSignalReference } from "./useSignalReference.ts"
import { useSignalValue } from "./useSignalValue.ts"

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
  const value = useSignalValue(finalSignal)
  const setValue = useSetSignal(finalSignal)

  return [value, setValue, finalSignal] as const
}
