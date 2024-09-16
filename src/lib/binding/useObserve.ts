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
  type BehaviorSubject
} from "rxjs"
import { useLiveRef } from "../utils/react/useLiveRef"
import { makeObservable } from "../queries/client/utils/makeObservable"

interface Option<R = undefined> {
  defaultValue: R
  unsubscribeOnUnmount?: boolean
}

export function useObserve<T>(source: BehaviorSubject<T>): T

export function useObserve<T>(source: Observable<T>): T | undefined

export function useObserve<T>(
  source: () => Observable<T>,
  deps: DependencyList
): T | undefined

export function useObserve<T>(
  source: () => Observable<T> | undefined,
  deps: DependencyList
): T | undefined

export function useObserve<T>(source: Observable<T>, options: Option<T>): T

export function useObserve<T>(
  source: () => Observable<T>,
  options: Option<T>,
  deps: DependencyList
): T

export function useObserve<T>(
  source$: Observable<T> | (() => Observable<T> | undefined),
  optionsOrDeps?: Option<T> | DependencyList,
  maybeDeps?: DependencyList
): T {
  const options =
    optionsOrDeps != null && !Array.isArray(optionsOrDeps)
      ? (optionsOrDeps as Option<T>)
      : ({
          defaultValue: undefined,
          unsubscribeOnUnmount: true
        } satisfies Option<undefined>)
  const deps =
    !maybeDeps && Array.isArray(optionsOrDeps)
      ? optionsOrDeps
      : typeof source$ === "function"
        ? (maybeDeps ?? [])
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

      const sub = makeObservable(source)
        .pipe(
          /**
           * @important
           * We only check primitives because underlying subscription might
           * be using objects and keeping same reference but pushing new
           * properties values
           */
          distinctUntilChanged((a: unknown, b: unknown) => a === b),
          tap((value) => {
            valueRef.current = value
          }),
          catchError((error) => {
            console.error(error)

            return EMPTY
          })
        )
        .subscribe(next)

      return () => {
        if (optionsRef.current.unsubscribeOnUnmount === false) return

        sub.unsubscribe()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...deps]
  )

  const getSnapshot = useCallback(() => {
    return valueRef.current
  }, [])

  const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return result as T
}
