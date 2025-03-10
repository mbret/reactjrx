import {
  type DependencyList,
  useCallback,
  useRef,
  useSyncExternalStore,
} from "react"
import {
  type BehaviorSubject,
  EMPTY,
  type Observable,
  catchError,
  distinctUntilChanged,
  identity,
  startWith,
  tap,
} from "rxjs"
import { makeObservable } from "../utils/makeObservable"
import { useLiveRef } from "../utils/react/useLiveRef"

interface Option<R = undefined> {
  defaultValue: R
  unsubscribeOnUnmount?: boolean
  compareFn?: (a: R, b: R) => boolean
}

export function useObserve<T>(source: BehaviorSubject<T>): T

export function useObserve<T>(source: Observable<T>): T | undefined

export function useObserve<T>(
  source: () => Observable<T>,
  deps: DependencyList,
): T | undefined

export function useObserve<T>(
  source: () => Observable<T> | undefined,
  deps: DependencyList,
): T | undefined

export function useObserve<T>(source: Observable<T>, options: Option<T>): T

export function useObserve<T>(
  source: () => Observable<T>,
  options: Option<T>,
  deps: DependencyList,
): T

export function useObserve<T>(
  source$: Observable<T> | (() => Observable<T> | undefined),
  optionsOrDeps?: Option<T> | DependencyList,
  maybeDeps?: DependencyList,
): T {
  const options =
    optionsOrDeps != null && !Array.isArray(optionsOrDeps)
      ? (optionsOrDeps as Option<T>)
      : ({
          defaultValue: undefined,
          unsubscribeOnUnmount: true,
          compareFn: undefined,
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
      : options.defaultValue,
  )
  const sourceRef = useLiveRef(source$)
  const optionsRef = useLiveRef(options)

  const getSnapshot = useCallback(() => {
    return valueRef.current
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const subscribe = useCallback(
    (next: () => void) => {
      const source = sourceRef.current

      const sub = makeObservable(source)()
        .pipe(
          optionsRef.current.defaultValue
            ? startWith(optionsRef.current.defaultValue)
            : identity,
          /**
           * @important there is already a Object.is comparison in place from react
           * so we only add a custom compareFn if provided
           */
          distinctUntilChanged((a, b) => {
            if (optionsRef.current.compareFn) {
              if (a === undefined || b === undefined) return false

              return optionsRef.current.compareFn(a, b)
            }

            return false
          }),
          tap((value) => {
            valueRef.current = value
          }),
          catchError((error) => {
            console.error(error)

            return EMPTY
          }),
        )
        .subscribe(next)

      return () => {
        if (optionsRef.current.unsubscribeOnUnmount === false) return

        sub.unsubscribe()
      }
    },
    [...deps],
  )

  const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return result as T
}
