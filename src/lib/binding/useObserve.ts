import {
  DependencyList,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore
} from "react"
import {
  Observable,
  tap,
  distinctUntilChanged,
  catchError,
  EMPTY,
  finalize,
  BehaviorSubject
} from "rxjs"
import { useLiveRef } from "../utils/useLiveRef";
import { primitiveEqual } from "../utils/primitiveEqual";

type Option<R = undefined> = { defaultValue: R; key?: string }

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
    unsafeOptions && !Array.isArray(unsafeOptions)
      ? (unsafeOptions as Option<R>)
      : ({ defaultValue: undefined, key: "" } satisfies Option<undefined>)
  const deps =
    !unsafeDeps && Array.isArray(unsafeOptions)
      ? unsafeOptions
      : typeof source$ === "function"
      ? unsafeDeps ?? []
      : [source$]
  const valueRef = useRef({
    data:
      "getValue" in source$ && typeof source$.getValue === "function"
        ? source$.getValue()
        : options.defaultValue,
    error: undefined
  })
  const sourceRef = useLiveRef(source$)

  useEffect(() => {
    valueRef.current.data = undefined
    valueRef.current.error = undefined
  }, [])

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
            valueRef.current = { data: value as any, error: undefined }
          }),
          finalize(next),
          catchError((error) => {
            console.error(error)

            valueRef.current = { ...valueRef.current, error }

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

  const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot).data

  return result as T | R
}
