import { useEffect, useRef } from "react"
import { Subject } from "rxjs"
import { useLiveRef } from "../utils/useLiveRef"
import { useConstant } from "../utils/useConstant"

/**
 * @see
 * useBehaviorSubject
 */
export const useSubject = <S>({
  onBeforeComplete
}: { onBeforeComplete?: () => void } = {}) => {
  const subject = useConstant(() => new Subject<S>())
  const completed = useRef(false)
  const onBeforeCompleteRef = useLiveRef(onBeforeComplete)

  useEffect(() => {
    if (completed.current) {
      subject.current = new Subject<S>()
      completed.current = false
    }

    return () => {
      if (!completed.current) {
        onBeforeCompleteRef.current && onBeforeCompleteRef.current()
        subject.current.complete()
        completed.current = true
      }
    }
  }, [])

  return subject
}