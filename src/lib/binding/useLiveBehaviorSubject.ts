import { useEffect } from "react"
import { BehaviorSubject } from "rxjs"
import { useConstant } from "../utils/react/useConstant"

export const useLiveBehaviorSubject = <S>(state: S) => {
  const subject = useConstant(() => new BehaviorSubject(state))

  useEffect(() => {
    subject.next(state)
  }, [state, subject])

  return subject
}
