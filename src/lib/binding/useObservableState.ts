import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useSyncExternalStore,
} from "react"
import { BehaviorSubject, skip } from "rxjs"
import { useConstant } from "../utils/react/useConstant"

export const useObservableState = <T>(
  defaultValue: T,
): [T, Dispatch<SetStateAction<T>>, BehaviorSubject<T>] => {
  const subject = useConstant(() => new BehaviorSubject(defaultValue))

  const setState = useCallback(
    (valueOrUpdater: SetStateAction<T>) => {
      const getNewValue = (valueOrUpdater: SetStateAction<T>) => {
        if (typeof valueOrUpdater === "function") {
          const updaterFn = valueOrUpdater as (prev: T) => T
          return updaterFn(subject.getValue())
        }

        return valueOrUpdater
      }

      const newValue = getNewValue(valueOrUpdater)

      if (newValue === subject.getValue()) {
        return
      }

      subject.next(newValue)
    },
    [subject],
  )

  const subscribe = useCallback(
    (onChange: () => void) => {
      /**
       * `BehaviorSubject` synchronously replays its current value to new
       * subscribers while `useSyncExternalStore` reads the initial value
       * through `getSnapshot`, so the first emission is skipped to only
       * notify React about actual changes.
       */
      const sub = subject.pipe(skip(1)).subscribe(onChange)

      return () => {
        sub.unsubscribe()
      }
    },
    [subject],
  )

  const getSnapshot = useCallback(() => subject.getValue(), [subject])

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return [value, setState, subject]
}
