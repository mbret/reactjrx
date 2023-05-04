import { type Signal } from "./signal"

export const useSignal = <S, R>(signal: Signal<S, R>) => {
  return [signal.useState(), signal.setState] as const
}
