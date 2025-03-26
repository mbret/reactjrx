import { useEffect, useState } from "react"
import { ReplaySubject, Subject } from "rxjs"
import { useConstant } from "../utils/react/useConstant"
import { useLiveRef } from "../utils/react/useLiveRef"

/**
 * @see
 * useBehaviorSubject
 */
export const useSubject = <S>({
  onBeforeComplete,
  completeOnUnmount = true,
}: { onBeforeComplete?: () => void; completeOnUnmount?: boolean } = {}) => {
  const subject = useConstant(() => new Subject<S>())
  const completedSubject = useConstant(() => new ReplaySubject<boolean>(1))
  const onBeforeCompleteRef = useLiveRef(onBeforeComplete)
  const completeOnUnmountRef = useLiveRef(completeOnUnmount)
  const [render, setRender] = useState(0)

  if (completedSubject.current) {
    subject.current = new Subject<S>()
    completedSubject.current = new ReplaySubject<boolean>(1)
  }

  useEffect(() => {
    return () => {
      /**
       * @important
       * In case we don't want to complete we still want to
       * flag it in order to be replaced with new subject on remount.
       */
      if (!completeOnUnmountRef.current) {
        return
      }

      if (onBeforeCompleteRef.current != null) {
        onBeforeCompleteRef.current()
      }

      completedSubject.current.next(true)

      subject.current = new Subject<S>()
      completedSubject.current = new ReplaySubject<boolean>(1)
      setRender((state) => state + 1)
    }
  }, [completeOnUnmountRef, onBeforeCompleteRef, completedSubject, subject])

  return [subject.current, completedSubject.current] as const
}
