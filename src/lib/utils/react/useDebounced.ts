import { useCallback, useRef } from "react"
import { useUnmount } from "./useUnmount"

/**
 * @param func Function to be debounced
 * @param wait time in ms to debounce function, default to 300
 * @returns the debounced callback function
 */
export const useDebounced = <T>(
  func: ((arg: T) => void) | (() => void),
  wait: number,
  options: {
    cancelOnUnmount?: boolean
  } = {},
) => {
  const { cancelOnUnmount = false } = options
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const callback = useCallback(
    (arg: T) => {
      timeout.current !== null && clearTimeout(timeout.current)
      timeout.current = setTimeout(() => func(arg), wait)
    },
    [func, wait],
  )

  useUnmount(() => {
    if (cancelOnUnmount) {
      timeout.current && clearTimeout(timeout.current)
    }
  })

  return callback
}
