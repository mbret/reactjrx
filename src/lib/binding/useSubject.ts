import { useEffect, useRef } from "react"
import { Subject } from "rxjs"
import { useLiveRef } from "../utils/react/useLiveRef"
import { useConstant } from "../utils/react/useConstant"

/**
 * @see
 * useBehaviorSubject
 */
export const useSubject = <S>({
  onBeforeComplete,
  completeOnUnmount = true
}: { onBeforeComplete?: () => void; completeOnUnmount?: boolean } = {}) => {
  const subject = useConstant(() => new Subject<S>())
  const completed = useRef(false)
  const onBeforeCompleteRef = useLiveRef(onBeforeComplete)
  const completeOnUnmountRef = useLiveRef(completeOnUnmount)

  useEffect(() => {
    if (completed.current) {
      subject.current = new Subject<S>()
      completed.current = false
    }

    return () => {
      /**
       * @important
       * In case we don't want to complete we still want to
       * flag it in order to be replaced with new subject on remount.
       */
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (!completeOnUnmountRef.current) {
        completed.current = true

        return
      }

      if (!completed.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (onBeforeCompleteRef.current != null) onBeforeCompleteRef.current()
        subject.current.complete()
        completed.current = true
      }
    }
  }, [completeOnUnmountRef, onBeforeCompleteRef, subject])

  return subject
}
