import { type Observable, defer, from, isObservable, of } from "rxjs"
import { isPromiseLike } from "../../../utils/isPromiseLike"

export const makeObservable = <Data>(
  something:
    | (() => Observable<Data>)
    | Promise<Data>
    | Observable<Data>
    | (() => Promise<Data>)
    | (() => Data)
    | Data
): Observable<Data> => {
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
