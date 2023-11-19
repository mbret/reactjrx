import { distinctUntilChanged, map } from "rxjs"
import { useObserve } from "../binding/useObserve"
import { type Signal } from "./signal"

export function useSignalValue<S, K, L>(
  signal: Signal<S, S, K>,
  selector: (value: S) => L
): L
export function useSignalValue<S, K>(signal: Signal<S, S, K>): S
export function useSignalValue<S, K, L>(
  signal: Signal<S, S, K>,
  selector?: (value: S) => L
) {
  const selectorOrDefault = selector ?? ((v) => v)

  return useObserve(
    () =>
      signal.subject.pipe(
        map((value) => selectorOrDefault(value)),
        distinctUntilChanged()
      ),
    {
      defaultValue: selectorOrDefault(signal.getValue())
    },
    []
  )
}
