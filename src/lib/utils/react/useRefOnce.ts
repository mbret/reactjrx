import { useRef } from "react"

const UNSET_SYMBOL = Symbol("UNSET")

export const useRefOnce = <T>(fn: () => T) => {
  const ref = useRef<T | typeof UNSET_SYMBOL>(UNSET_SYMBOL)

  if (ref.current === UNSET_SYMBOL) {
    ref.current = fn()
  }

  return ref as { current: T }
}
