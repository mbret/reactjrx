import { useEffect, useRef } from "react"
import { Subject } from "rxjs"
import { useLiveRef } from "./utils/useLiveRef"

/**
 * @see
 * useBehaviorSubject
 */
export const useSubject = <S>({
  onBeforeComplete
}: { onBeforeComplete?: () => void } = {}) => {
  const subject = useRef(new Subject<S>())
  const completed = useRef(false)
  const onBeforeCompleteRef = useLiveRef(onBeforeComplete)
  // useEffect(() => {
  // setParams((s) => {
  //   if (!s.completed) {
  //     return s;
  //   } else {
  //     return {
  //       subject: new Subject(),
  //       completed: false,
  //     };
  //   }
  // });

  //   return () => {
  //     /**
  //      * We complete subject in a timeout to give a chance to consumer
  //      * to eventually dispatch next() or other operation during
  //      * same effect cycle. Otherwise this would complete the subject
  //      * before any other operation can be done
  //      */
  //     // setTimeout(() => {
  //     params.subject.complete();
  //     // });
  //     setParams((s) => ({ subject: new Subject(), completed: true }));
  //   };
  // }, []);

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
