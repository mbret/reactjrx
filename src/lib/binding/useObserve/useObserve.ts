import { type DependencyList, useSyncExternalStore } from "react"
import type { BehaviorSubject, Observable } from "rxjs"
import type { UseObserveResult } from "./types"
import { useStore } from "./useStore"

interface Option<T, R = undefined> {
  defaultValue: R
  compareFn?: (a: T, b: T) => boolean
}

export function useObserve<T>(
  source: BehaviorSubject<T>,
): UseObserveResult<T, T>

export function useObserve<T>(
  source: BehaviorSubject<T>,
  options: Omit<Option<T>, "defaultValue">,
): UseObserveResult<T, T>

export function useObserve<T>(
  source: Observable<T>,
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
  source: Observable<T>,
  options: Option<T, DefaultValue>,
): UseObserveResult<T, DefaultValue>

export function useObserve<T, DefaultValue>(
  source: () => Observable<T>,
  options: Option<T, DefaultValue>,
  deps: DependencyList,
): UseObserveResult<T, DefaultValue>

export function useObserve<T, DefaultValue = T>(
  source$: Observable<T> | (() => Observable<T> | undefined),
  optionsOrDeps?: Partial<Option<DefaultValue>> | DependencyList,
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
