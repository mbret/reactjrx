import { type Signal } from "./signal"
import { useSetSignal } from "./useSetSignal"
import { useSignalValue } from "./useSignalValue"

export const useSignal = <S, R>(signal: Signal<S, R>) => {
  return [useSignalValue(signal), useSetSignal(signal)] as const
}
