import {
  type DependencyList,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react"
import {
  type BehaviorSubject,
  catchError,
  distinctUntilChanged,
  EMPTY,
  identity,
  type Observable,
  type Subscription,
  shareReplay,
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
  const valueRef = useRef<{ value: T | undefined } | undefined>(undefined)
  const sourceRef = useLiveRef(source$)
  const optionsRef = useLiveRef(options)

  // biome-ignore lint/correctness/useExhaustiveDependencies: TODO
  const observable = useMemo(
    () => ({
      observable: makeObservable(sourceRef.current)().pipe(
        shareReplay({ refCount: true, bufferSize: 1 }),
      ),
      subscribed: false,
      snapshotSub: undefined as Subscription | undefined,
    }),
    [...deps],
  )

  const getSnapshot = useCallback(() => {
    /**
     * If getting a snapshot before the observable has been subscribed, we will subscribe to it to get a chance
     * to retrieve the actual value if the observable is synchronous.
     * This is to avoid re-rendering the hook in the situation where we can actually have a value already.
     */
    if (!observable.subscribed) {
      observable.subscribed = true

      const sub = observable.observable.subscribe((v) => {
        valueRef.current = { value: v }
      })

      observable.snapshotSub = sub
    }

    if (valueRef.current === undefined) return optionsRef.current.defaultValue

    return valueRef.current?.value
  }, [observable, optionsRef])

  // biome-ignore lint/correctness/useExhaustiveDependencies: TODO
  const subscribe = useCallback(
    (next: () => void) => {
      observable.subscribed = true

      const sub = observable.observable
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
            valueRef.current = { value }
          }),
          catchError((error) => {
            console.error(error)

            return EMPTY
          }),
        )
        .subscribe(next)

      /**
       * Unsubscribe from early snapshot subscription to avoid re-running the original observable.
       * From this point onward we have an active subscription to the observable.
       */
      observable.snapshotSub?.unsubscribe()

      return () => {
        if (optionsRef.current.unsubscribeOnUnmount === false) return

        sub.unsubscribe()
      }
    },
    [observable],
  )

  const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return result as T
}
