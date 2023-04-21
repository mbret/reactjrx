import { useSubject } from "./useSubject"

export const useTrigger = <T>() => {
  const subject = useSubject<T>()

  return [subject.current.asObservable(), subject.current.next] as const
}
