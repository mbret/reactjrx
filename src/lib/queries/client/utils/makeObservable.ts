import { type Observable, defer, from, isObservable, of } from "rxjs"
import { isPromiseLike } from "../../../utils/isPromiseLike"

export function makeObservable<Data>(
  fn: () => Observable<Data> | Data | Promise<Data>
): Observable<Data>
export function makeObservable<Data>(
  fn: () => Data
): Data extends Observable<infer ObservedData>
  ? Observable<ObservedData>
  : Data extends Promise<infer ThenData>
    ? Observable<ThenData>
    : Observable<Data>
export function makeObservable<Data>(fn: Data): Observable<Data>
export function makeObservable<Data>(fn: Promise<Data>): Observable<Data>
export function makeObservable<Data>(fn: Observable<Data>): Observable<Data>
export function makeObservable<Data>(
  something:
    | (() => Observable<Data>)
    | Promise<Data>
    | Observable<Data>
    | (() => Promise<Data>)
    | (() => Data)
    | Data
): Observable<Data> {
  if (isObservable(something)) return something

  if (isPromiseLike(something)) return from(something)

  if (typeof something !== "function") return of(something)

  const somethingAsFunction = something as
    | (() => Observable<Data>)
    | (() => Promise<Data>)
    | (() => Data)

  return defer(() => {
    const result = somethingAsFunction()

    if (isPromiseLike(result)) {
      return from(result)
    }

    if (isObservable(result)) {
      return result
    }

    return of(result)
  })
}
