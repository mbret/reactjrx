import { useCallback } from "react"
import { BehaviorSubject, type Observable } from "rxjs"
import { useConstant } from "../utils/react/useConstant"
import { useLiveRef } from "../utils/react/useLiveRef"

/**
 * If you need to represent some piece of state as an observable and also want the ability to change
 * this state during the lifetime of the component, useObservableState
 * is for you. It acts like React.useState(), only that
 * it returns an observable representing changes to the
 * value instead of the value itself. The callback/setter
 * returned acts like a the regular callback you
 * would otherwise get from React.useState. This is useful when you want
 * to compose the state change together with other observables.
 *
 * @important
 * The last array value is the value itself in case
 * you need a direct reference to the value
 */
export const useObservableState = <T>(
  defaultValue: T,
): [Observable<T>, (value: T) => void, T] => {
  const subject = useConstant(() => new BehaviorSubject(defaultValue))

  const subject$ = useLiveRef(subject)

  const setState = useCallback(
    (value: T) => {
      subject.next(value)
    },
    [subject],
  )

  return [subject$.current, setState, subject.getValue()]
}
