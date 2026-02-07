import { type Dispatch, type SetStateAction, useCallback } from "react"
import { BehaviorSubject } from "rxjs"
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

  const value = subject.getValue()

  return [value, setState, subject]
}
