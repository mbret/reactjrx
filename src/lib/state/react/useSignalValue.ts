import { distinctUntilChanged, map } from "rxjs"
import { useObserve } from "../../binding/useObserve"
import { useLiveRef } from "../../utils"
import { type Signal, VirtualSignal } from "../Signal"
import {
  useMakeOrRetrieveSignal,
  useSignalContext,
} from "./SignalContextProvider"

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
  const signalContext = useSignalContext()

  if (signal instanceof VirtualSignal && !signalContext) {
    throw new Error(
      "useSignalValue must be used within a SignalContextProvider",
    )
  }

  const finalSignal = (useMakeOrRetrieveSignal(
    signal instanceof VirtualSignal ? signal : undefined,
  ) ?? signal) as Signal<unknown>

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
