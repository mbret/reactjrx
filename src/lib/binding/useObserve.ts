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
  unsubscribeOnUnmount?: boolean
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

export function useObserve<T>(source: Observable<T>, options: Option<T>): T

export function useObserve<T>(
  source: () => Observable<T>,
  options: Option<T>,
  deps: DependencyList
): T

export function useObserve<T>(
  source$: Observable<T> | (() => Observable<T>),
  unsafeOptions?: Option<T> | DependencyList,
  unsafeDeps?: DependencyList
): T {
  const options =
    unsafeOptions != null && !Array.isArray(unsafeOptions)
      ? (unsafeOptions as Option<T>)
      : ({
          defaultValue: undefined,
          key: "",
          unsubscribeOnUnmount: true
        } satisfies Option<undefined>)
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
  const optionsRef = useLiveRef(options)

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
        if (optionsRef.current.unsubscribeOnUnmount === false) return

        sub.unsubscribe()
      }
    },
    [...deps]
  )

  const getSnapshot = useCallback(() => {
    return valueRef.current
  }, [])

  const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return result as T
}
