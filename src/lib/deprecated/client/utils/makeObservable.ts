import { Observable, defer, from, isObservable, of } from "rxjs"
import { isPromiseLike } from "../../../utils/isPromiseLike"

type FnReturnToObservable<T> =
  T extends Observable<infer ObservedData>
    ? ObservedData
    : T extends Promise<infer ThenData>
      ? ThenData
      : T

export function makeObservable<Data>(fn: Observable<Data>): Observable<Data>
export function makeObservable<Data>(fn: Promise<Data>): Observable<Data>
export function makeObservable<Data>(
  fn: Promise<Data> | Observable<Data>
): Observable<Data>
export function makeObservable<Data>(
  fn: () => Promise<Data> | Observable<Data>
): Observable<Data>
/**
 * Generic factory
 */
export function makeObservable<TContext>(
  fn: () =>
    | Promise<TContext | undefined>
    | Observable<TContext | undefined>
    | TContext
    | undefined
): Observable<undefined | TContext>
/**
 * Generic factory
 */
export function makeObservable<Return>(
  fn: () => Return
): Observable<FnReturnToObservable<Return>>
/**
 * Generic factory OR Observable
 */
export function makeObservable<Data, Return>(
  fn: Observable<Data> | (() => Return)
): Observable<Data | FnReturnToObservable<Return>>
export function makeObservable<Data>(fn: Data): Observable<Data>
/**
 * Convert the input into an observable.
 *
 * - Observable: return the same observable
 * - Promise: return an observable from the promise
 * - Data: return an observable from the data
 * - Function: Execute the function and return an observable from the result
 */
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
