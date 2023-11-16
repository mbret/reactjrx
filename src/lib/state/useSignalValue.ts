import { useObserve } from "../binding/useObserve"
import { type Signal } from "./signal"

export const useSignalValue = <S, K>(signal: Signal<S, S, K>, key?: string) => {
  return useObserve(signal.subject, { defaultValue: signal.getValue(), key })
}
