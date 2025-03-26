import { useEffect, useState } from "react"
import { ReplaySubject } from "rxjs"
import { useRefOnce } from "./useRefOnce"

export const useUnmountObservable = () => {
  const replaySubject = useRefOnce(() => new ReplaySubject(1))
  const [completed, setCompleted] = useState(false)

  if (completed) {
    replaySubject.current = new ReplaySubject(1)
    setCompleted(false)
  }

  useEffect(() => {
    return () => {
      replaySubject.current.next(undefined)
      setCompleted(true)
    }
  }, [replaySubject])

  return replaySubject.current
}
