import { useCallback } from "react"
import type { Observable } from "rxjs"
import { useLiveRef } from "../utils"
import { useSubject } from "./useSubject"

/**
 * This creates an event handler and an observable that represents calls to that handler.
 */
export const useObservableCallback = <T = void>(): readonly [
  Observable<T>,
  (arg: T) => void,
] => {
  const [subject] = useSubject<T>()
  const subjectRef = useLiveRef(subject)

  const trigger = useCallback(
    (arg: T) => {
      subjectRef.current.next(arg)
    },
    [subjectRef],
  )

  return [subject, trigger] as const
}
