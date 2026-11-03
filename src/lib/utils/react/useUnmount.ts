import { useEffectOnce } from "./useEffectOnce"
import { useLiveRef } from "./useLiveRef"

// biome-ignore lint/suspicious/noExplicitAny: Expected any
export const useUnmount = (fn: () => any): void => {
  const fnRef = useLiveRef(fn)

  useEffectOnce(() => () => fnRef.current())
}
