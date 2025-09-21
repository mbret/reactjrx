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
  map,
  type Observable,
  type Subscription,
  shareReplay,
  startWith,
  tap,
} from "rxjs"
import { filterObjectByKey } from "../utils/filterObjectByKey"
import { makeObservable } from "../utils/makeObservable"
import { useLiveRef } from "../utils/react/useLiveRef"
import { isShallowEqual } from "../utils/shallowEqual"

interface Option<R = undefined> {
  defaultValue: R
  unsubscribeOnUnmount?: boolean
  compareFn?: (a: R, b: R) => boolean
}

export function useObserve<T>(source: BehaviorSubject<T>): T
export function useObserve<T extends object, SelectorKeys extends keyof T>(
  source: BehaviorSubject<T>,
  selector: SelectorKeys[],
): { [K in SelectorKeys]: T[K] }
export function useObserve<T>(
  source: BehaviorSubject<T>,
  options: Omit<Option<T>, "defaultValue">,
): T

export function useObserve<T>(source: Observable<T>): T | undefined
export function useObserve<T extends object, SelectorKeys extends keyof T>(
  source: Observable<T>,
  selector: SelectorKeys[],
): { [K in SelectorKeys]: T[K] } | undefined

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

export function useObserve<T, SelectorKeys extends keyof T>(
  source$: Observable<T> | (() => Observable<T> | undefined),
  optionsOrDeps?: Partial<Option<T>> | DependencyList | SelectorKeys[],
  maybeDeps?: DependencyList,
): T {
  const options =
    optionsOrDeps != null && !Array.isArray(optionsOrDeps)
      ? (optionsOrDeps as Partial<Option<T>>)
      : ({
          defaultValue: undefined,
          unsubscribeOnUnmount: true,
          compareFn: undefined,
        } satisfies Partial<Option<T>>)
  const deps =
    !maybeDeps && Array.isArray(optionsOrDeps)
      ? optionsOrDeps
      : typeof source$ === "function"
        ? (maybeDeps ?? [])
        : [source$]
  const valueRef = useRef<{ value: T | undefined } | undefined>(undefined)
  const sourceRef = useLiveRef(source$)
  const optionsRef = useLiveRef(options)
  const selectorKey =
    typeof source$ !== "function" && Array.isArray(optionsOrDeps)
      ? JSON.stringify(optionsOrDeps)
      : undefined
  const selectorRef = useLiveRef(
    typeof source$ !== "function" && Array.isArray(optionsOrDeps)
      ? (optionsOrDeps as SelectorKeys[])
      : undefined,
  )

  const observable = useMemo(() => {
    void selectorKey

    const selectorOption = selectorRef.current
    const compareFnOption = optionsRef.current.compareFn
    const compareFn = compareFnOption
      ? compareFnOption
      : selectorOption
        ? isShallowEqual
        : undefined
    const observable$ = makeObservable(sourceRef.current)()

    return {
      observable: observable$.pipe(
        // Maybe selector
        map((v) => {
          if (selectorOption && typeof v === "object" && v !== null) {
            return filterObjectByKey(v, selectorOption) as T | undefined
          }

          return v
        }),
        // Maybe compareFn
        distinctUntilChanged((a, b) => {
          if (a === undefined || b === undefined) return false

          if (compareFn) {
            return compareFn(a as T, b as T)
          }

          return a === b
        }),
        shareReplay({ refCount: true, bufferSize: 1 }),
      ),
      subscribed: false,
      snapshotSub: undefined as Subscription | undefined,
    }
  }, [...deps, selectorKey, selectorRef, sourceRef, optionsRef])

  const getSnapshot = useCallback(() => {
    /**
     * If getting a snapshot before the observable has been subscribed, we will subscribe to it to get a chance
     * to retrieve the actual value if the observable is synchronous.
     * This is to avoid re-rendering the hook in the situation where we can actually have a value already.
     */
    if (!observable.subscribed) {
      observable.subscribed = true

      const sub = observable.observable.subscribe((value) => {
        valueRef.current = { value: value as T }
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
          tap((value) => {
            valueRef.current = { value: value as T }
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
