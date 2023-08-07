import { type Signal } from "./signal"
import { useSetSignal } from "./useSetSignal"
import { useSignalValue } from "./useSignalValue"

export const useSignal = <S>(signal: Signal<S, S>) => {
  return [useSignalValue(signal), useSetSignal(signal)] as const
}
