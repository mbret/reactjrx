import { type Signal } from "./signal"

export const useSignalValue = <S, R>(signal: Signal<S, R>) => {
  return signal.useState()
}
