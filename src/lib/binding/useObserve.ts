import {
  type DependencyList,
  useCallback,
  useRef,
  useSyncExternalStore
} from "react"
import {
  type Observable,
  tap,
  distinctUntilChanged,
  catchError,
  EMPTY,
  finalize,
  type BehaviorSubject
} from "rxjs"
import { useLiveRef } from "../utils/useLiveRef"
import { primitiveEqual } from "../utils/primitiveEqual"

interface Option<R = undefined> {
  defaultValue: R
  key?: string
}

/**
 * @todo return first value if source is behavior subject
 */

export function useObserve<T>(source: BehaviorSubject<T>): T

export function useObserve<T>(source: Observable<T>): T | undefined

export function useObserve<T>(
  source: () => Observable<T>,
  deps: DependencyList
): T | undefined

export function useObserve<T, R = undefined>(
  source: Observable<T>,
  options: Option<R>
): T | R

export function useObserve<T, R = undefined>(
  source: () => Observable<T>,
  options: Option<R>,
  deps: DependencyList
): T | R

export function useObserve<T, R>(
  source$: Observable<T> | (() => Observable<T>),
  unsafeOptions?: Option<R> | DependencyList,
  unsafeDeps?: DependencyList
): T | R {
  const options =
    unsafeOptions != null && !Array.isArray(unsafeOptions)
      ? (unsafeOptions as Option<R>)
      : ({ defaultValue: undefined, key: "" } satisfies Option<undefined>)
  const deps =
    unsafeDeps == null && Array.isArray(unsafeOptions)
      ? unsafeOptions
      : typeof source$ === "function"
      ? unsafeDeps ?? []
      : [source$]
  const valueRef = useRef(
    "getValue" in source$ && typeof source$.getValue === "function"
      ? source$.getValue()
      : options.defaultValue
  )
  const sourceRef = useLiveRef(source$)

  const subscribe = useCallback(
    (next: () => void) => {
      const source = sourceRef.current
      const makeObservable =
        typeof source === "function" ? source : () => source

      const sub = makeObservable()
        .pipe(
          /**
           * @important
           * We only check primitives because underlying subscription might
           * be using objects and keeping same reference but pushing new
           * properties values
           */
          distinctUntilChanged(primitiveEqual),
          tap((value) => {
            valueRef.current = value as any
          }),
          finalize(next),
          catchError((error) => {
            console.error(error)

            valueRef.current = undefined

            return EMPTY
          })
        )
        .subscribe(next)

      return () => {
        sub.unsubscribe()
      }
    },
    [...deps]
  )

  const getSnapshot = useCallback(() => {
    return valueRef.current
  }, [])

  const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return result as T | R
}
