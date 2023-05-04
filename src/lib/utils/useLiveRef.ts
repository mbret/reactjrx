import { useMemo, useRef } from 'react'

export const useLiveRef = <T>(value: T) => {
  const ref = useRef(value)

  /**
   * We dont update the value on render because of potential
   * bug related to react concurrency mode.
   * We don't update the value in a useEffect because effects run after
   * render and we could maybe? have situation where the ref
   * is being called after render but before effect?
   * I am not sure of that one.
   *
   * `useMemo` is a good compromise since it runs during render but before
   * repaint. It prevents the concurrency mode issue.
   */
  useMemo(() => {
    ref.current = value
  }, [value])

  return ref
}
