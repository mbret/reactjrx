import { useCallback, useEffect, useRef } from "react"
import { useLiveRef } from "./useLiveRef"

/**
 * @param func Function to be debounced. The latest `func` runs when the delay ends.
 * @param wait Delay in ms, restarted by each call.
 * @param options.cancelOnUnmount Cancels a pending call when the component
 * unmounts. Defaults to `false`, so a pending call, such as a save, still runs.
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
  const funcRef = useLiveRef(func)
  const cancelOnUnmountRef = useLiveRef(cancelOnUnmount)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const callback = useCallback(
    (arg: T) => {
      timeout.current !== null && clearTimeout(timeout.current)
      timeout.current = setTimeout(() => funcRef.current(arg), wait)
    },
    [funcRef, wait],
  )

  useEffect(
    () => () => {
      if (cancelOnUnmountRef.current && timeout.current !== null) {
        clearTimeout(timeout.current)
      }
    },
    [cancelOnUnmountRef],
  )

  return callback
}
