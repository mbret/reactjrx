import { useObserve } from "../binding/useObserve"
import { type Signal } from "./signal"

export const useSignalValue = <S>(signal: Signal<S, S>, key?: string) => {
  return useObserve(signal.subject, { defaultValue: signal.getValue(), key })
}
