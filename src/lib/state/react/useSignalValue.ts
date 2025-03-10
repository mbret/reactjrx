import { distinctUntilChanged, map } from "rxjs"
import { useObserve } from "../../binding/useObserve"
import { useLiveRef } from "../../utils"
import type { Signal, VirtualSignal } from "../Signal"
import { useSignalReference } from "./useSignalReference"

export function useSignalValue<T>(signal: VirtualSignal<T>): T

export function useSignalValue<T, SelectValue>(
  signal: VirtualSignal<T>,
  selector: (value: T) => SelectValue,
): SelectValue

export function useSignalValue<T>(signal: Signal<T>): T

export function useSignalValue<T, SelectValue>(
  signal: Signal<T>,
  selector: (value: T) => SelectValue,
): SelectValue

export function useSignalValue<T, SelectValue>(
  signal: Signal<T>,
  selector: (value: T) => SelectValue,
): SelectValue | undefined

export function useSignalValue(
  signal: Signal<unknown> | VirtualSignal<unknown>,
  selector?: (value: unknown) => unknown,
) {
  const selectorRef = useLiveRef(selector)

  const finalSignal = useSignalReference(signal)

  return useObserve(
    () => {
      const defaultSelector = selectorRef.current ?? ((value: unknown) => value)

      const observed$ = finalSignal.pipe(
        map(defaultSelector),
        distinctUntilChanged(),
      )

      return observed$
    },
    {
      defaultValue: selector
        ? selector?.(finalSignal.value)
        : finalSignal.value,
    },
    [finalSignal],
  )
}
