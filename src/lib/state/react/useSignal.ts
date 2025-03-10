import type { Signal, VirtualSignal } from "../Signal"
import { useSetSignal } from "./useSetSignal"
import { useSignalValue } from "./useSignalValue"

export function useSignal<T>(signal: VirtualSignal<T>): [T, Signal<T>["update"]]

export function useSignal<T>(signal: Signal<T>): [T, Signal<T>["next"]]

export function useSignal<T>(
  signal: Signal<T>,
): [T | undefined, Signal<T>["next"]]

export function useSignal<T>(signal: Signal<T> | VirtualSignal<T>) {
  const value = useSignalValue(signal)

  const setValue = useSetSignal(signal)

  return [value, setValue] as const
}
