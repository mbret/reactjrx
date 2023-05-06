import { type Signal } from "./signal"

export const useSetSignal = <S, R>(signal: Signal<S, R>) => {
  return signal.setState
}
