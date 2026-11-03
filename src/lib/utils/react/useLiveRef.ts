import { useLayoutEffect, useRef } from "react"

export const useLiveRef = <T>(value: T) => {
  const ref = useRef(value)

  /**
   * Written after commit, so a render that React drops (for example, a
   * suspended transition) never reaches the ref. Read during render, the
   * ref holds the last committed value.
   */
  useLayoutEffect(() => {
    ref.current = value
  }, [value])

  return ref
}
