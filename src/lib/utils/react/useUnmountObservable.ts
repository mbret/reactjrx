import { useSubject } from "../../binding/useSubject"

export const useUnmountObservable = () => {
  const [, completed] = useSubject<boolean>()

  return completed
}
