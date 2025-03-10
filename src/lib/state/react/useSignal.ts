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
  const value = useSignalValue(signal)
  const setValue = useSetSignal(signal)

  return [value, setValue, finalSignal] as const
}
