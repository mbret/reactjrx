import { useEffect } from "react"
import { BehaviorSubject } from "rxjs"
import { useConstant } from "../utils/react/useConstant"

export const useLiveBehaviorSubject = <S>(state: S) => {
  const subject = useConstant(() => new BehaviorSubject(state))

  useEffect(() => {
    /**
     * The subject already holds the initial state, so the mount effect must not
     * emit it a second time.
     */
    if (!Object.is(subject.getValue(), state)) {
      subject.next(state)
    }
  }, [state, subject])

  return subject
}
