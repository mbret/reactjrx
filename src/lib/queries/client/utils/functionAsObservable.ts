import { Observable, defer, from, of } from "rxjs"

export const functionAsObservable = <Data>(
  fn: () => Observable<Data> | Promise<Data> | Data
): Observable<Data> => {
  return defer(() => {
    const result = fn()

    if (result instanceof Promise) {
      return from(result)
    }

    if (result instanceof Observable) {
      return result
    }

    return of(result)
  })
}
