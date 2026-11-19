import { useConstant } from "../../utils/index.ts"
import type { Signal } from "../Signal.ts"
import { useSignalValue } from "./useSignalValue.ts"

// biome-ignore lint/suspicious/noExplicitAny: TODO
export const useSignalState = <S extends Signal<any, any>>(
  fn: () => S,
): [S["value"], S] => {
  const signal = useConstant(fn)
  const value = useSignalValue(signal)

  return [value, signal] as const
}
