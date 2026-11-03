import { useLayoutEffect, useRef } from "react"

export const useMemoCompare = <T>(
  value: T,
  compare: (a: T, b: T) => boolean,
) => {
  /**
   * Written after commit, so each render compares with the last committed
   * value, never with one from a render that React dropped.
   */
  const committed = useRef<{ value: T }>({ value })
  const previous = committed.current.value
  const result =
    Object.is(value, previous) || compare(value, previous) ? previous : value

  useLayoutEffect(() => {
    committed.current = { value: result }
  }, [result])

  return result
}
