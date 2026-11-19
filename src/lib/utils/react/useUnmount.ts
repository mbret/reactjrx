import { useEffectOnce } from "./useEffectOnce.ts"
import { useLiveRef } from "./useLiveRef.ts"

// biome-ignore lint/suspicious/noExplicitAny: Expected any
export const useUnmount = (fn: () => any): void => {
  const fnRef = useLiveRef(fn)

  useEffectOnce(() => () => fnRef.current())
}
