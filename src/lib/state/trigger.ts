import { Observable, Subject, identity } from "rxjs"

export function trigger(): [Observable<void>, () => void]

export function trigger<A extends unknown[], T>(
  mapper: (...args: A) => T
): [Observable<T>, (...args: A) => void]

export function trigger<T>(): [Observable<T>, (payload: T) => void]

export function trigger<A extends unknown[], T>(
  mapper: (...args: A) => T = identity as any
): [Observable<T>, (...args: A) => void] {
  const subject = new Subject<T>()

  return [subject.asObservable(), (...args: A) => subject.next(mapper(...args))]
}
