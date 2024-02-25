import { useCallback } from "react"
import { useSubject } from "./useSubject"
import { useLiveRef } from "../utils/useLiveRef"

/**
 * This creates an event handler and an observable that represents calls to that handler.
 */
export const useObserveCallback = <T = void>() => {
  const subject = useSubject<T>()

  const event$ = useLiveRef(subject.current.asObservable())

  const trigger = useCallback(
    (arg: T) => {
      subject.current.next(arg)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return [event$.current, trigger] as const
}
