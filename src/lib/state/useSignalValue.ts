import { useObserve } from "../binding/useObserve"
import { type Signal } from "./signal"

export const useSignalValue = <S, R>(signal: Signal<S, R>, key?: string) => {
  return useObserve(signal.subject, { defaultValue: signal.getValue(), key })
}
