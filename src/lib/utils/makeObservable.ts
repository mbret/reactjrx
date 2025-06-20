import { defer, from, isObservable, type Observable, of } from "rxjs"
import { isPromiseLike } from "./isPromiseLike"

type FnReturnToObservable<T> = T extends Observable<infer ObservedData>
  ? ObservedData
  : T extends Promise<infer ThenData>
    ? ThenData
    : T

export function makeObservable<Data>(
  fn: Observable<Data>,
): () => Observable<Data>

export function makeObservable<Data>(fn: Promise<Data>): () => Observable<Data>

export function makeObservable<Data>(
  fn: Promise<Data> | Observable<Data>,
): () => Observable<Data>

export function makeObservable<Data>(
  fn: () => Promise<Data> | Observable<Data>,
): () => Observable<Data>

/**
 * Generic factory
 */
export function makeObservable<Data>(
  fn: () => Promise<Data> | Observable<Data> | Data,
): () => Observable<Data>

/**
 * Generic factory
 */
export function makeObservable<Data, Params>(
  fn: (params: Params) => Data,
): (params: Params) => Observable<FnReturnToObservable<Data>>

/**
 * Generic factory OR Observable
 */
export function makeObservable<Data, Return>(
  fn: Observable<Data> | (() => Return),
): () => Observable<Data | FnReturnToObservable<Return>>

export function makeObservable<Data>(fn: Data): () => Observable<Data>

/**
 * Convert the input into an observable.
 *
 * - Observable: return the same observable
 * - Promise: return an observable from the promise
 * - Data: return an observable from the data
 * - Function: Execute the function and return an observable from the result
 */
export function makeObservable<Data, Params>(
  something:
    | ((params: Params) => Observable<Data>)
    | Promise<Data>
    | Observable<Data>
    | ((params: Params) => Promise<Data>)
    | ((params: Params) => Data)
    | Data,
): (params: Params) => Observable<Data> {
  if (isObservable(something)) return () => something

  if (isPromiseLike(something)) return () => from(something)

  if (typeof something !== "function") return () => of(something)

  const somethingAsFunction = something as
    | ((params: Params) => Observable<Data>)
    | ((params: Params) => Promise<Data>)
    | ((params: Params) => Data)

  return (params: Params) =>
    defer(() => {
      const result = somethingAsFunction(params)

      if (isPromiseLike(result)) {
        return from(result)
      }

      if (isObservable(result)) {
        return result
      }

      return of(result)
    })
}
