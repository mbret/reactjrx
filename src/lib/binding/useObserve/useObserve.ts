import { type DependencyList, useSyncExternalStore } from "react"
import type { BehaviorSubject, Observable } from "rxjs"
import type { UseObserveResult } from "./types"
import { useStore } from "./useStore"

export type { UseObserveOptions, UseObserveResult } from "./types"

interface Option<T, R = undefined> {
  defaultValue: R
  compareFn?: (a: T, b: T) => boolean
}

/**
 * The source can be `undefined` (directly or returned from a factory). This is
 * useful when the observable is not available yet (lazily created, coming from
 * a state, a prop, etc). In that case the hook returns the default value with a
 * `complete` observable state and will start observing as soon as an actual
 * source is given.
 */
export function useObserve(
  source: undefined,
): UseObserveResult<never, undefined>

export function useObserve<DefaultValue>(
  source: undefined,
  options: Option<unknown, DefaultValue>,
): UseObserveResult<never, DefaultValue>

export function useObserve<T>(
  source: BehaviorSubject<T>,
): UseObserveResult<T, T>

export function useObserve<T>(
  source: BehaviorSubject<T>,
  options: Omit<Option<T>, "defaultValue">,
): UseObserveResult<T, T>

export function useObserve<T>(
  source: Observable<T> | undefined,
): UseObserveResult<T, undefined>

export function useObserve<T>(
  source: () => Observable<T>,
  deps: DependencyList,
): UseObserveResult<T, undefined>

export function useObserve<T>(
  source: () => Observable<T> | undefined,
  deps: DependencyList,
): UseObserveResult<T, undefined>

export function useObserve<T, DefaultValue>(
  source: Observable<T> | undefined,
  options: Option<T, DefaultValue>,
): UseObserveResult<T, DefaultValue>

export function useObserve<T>(
  source: Observable<T> | undefined,
  options: Omit<Option<T>, "defaultValue">,
): UseObserveResult<T, undefined>

export function useObserve<T, DefaultValue>(
  source: () => Observable<T>,
  options: Option<T, DefaultValue>,
  deps: DependencyList,
): UseObserveResult<T, DefaultValue>

export function useObserve<T, DefaultValue>(
  source: () => Observable<T> | undefined,
  options: Option<T, DefaultValue>,
  deps: DependencyList,
): UseObserveResult<T, DefaultValue>

export function useObserve<T, DefaultValue = T>(
  source$: Observable<T> | undefined | (() => Observable<T> | undefined),
  optionsOrDeps?: Partial<Option<T, DefaultValue>> | DependencyList,
  maybeDeps?: DependencyList,
): UseObserveResult<T, DefaultValue | undefined> {
  const options =
    optionsOrDeps != null && !Array.isArray(optionsOrDeps)
      ? (optionsOrDeps as Partial<Option<T, DefaultValue>>)
      : ({
          defaultValue: undefined,
          compareFn: undefined,
        } satisfies Partial<Option<T, DefaultValue>>)
  const deps =
    !maybeDeps && Array.isArray(optionsOrDeps)
      ? optionsOrDeps
      : typeof source$ === "function"
        ? (maybeDeps ?? [])
        : [source$]

  const store = useStore<T, DefaultValue | undefined>(source$, options, deps)

  const result = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )

  return result
}
