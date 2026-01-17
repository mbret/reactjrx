import { type DependencyList, useRef, useSyncExternalStore } from "react"
import type { BehaviorSubject, Observable } from "rxjs"
import { useLiveRef } from "../../utils/react/useLiveRef"
import type { UseObserveResult } from "./types"
import { useStore } from "./useStore"

interface Option<R = undefined> {
  defaultValue: R
  compareFn?: (a: R, b: R) => boolean
}

export function useObserve<T>(
  source: BehaviorSubject<T>,
): UseObserveResult<T, T>

export function useObserve<T extends object, SelectorKeys extends keyof T>(
  source: BehaviorSubject<T>,
  selector: SelectorKeys[],
): UseObserveResult<
  { [K in SelectorKeys]: T[K] },
  { [K in SelectorKeys]: T[K] }
>

export function useObserve<T>(
  source: BehaviorSubject<T>,
  options: Omit<Option<T>, "defaultValue">,
): UseObserveResult<T, T>

export function useObserve<T>(
  source: Observable<T>,
): UseObserveResult<T, undefined>

export function useObserve<T extends object, SelectorKeys extends keyof T>(
  source: Observable<T>,
  selector: SelectorKeys[],
): UseObserveResult<
  { [K in SelectorKeys]: T[K] },
  { [K in SelectorKeys]: T[K] } | undefined
>

export function useObserve<T>(
  source: () => Observable<T>,
  deps: DependencyList,
): UseObserveResult<T, undefined>

export function useObserve<T>(
  source: () => Observable<T> | undefined,
  deps: DependencyList,
): UseObserveResult<T, undefined>

export function useObserve<T>(
  source: Observable<T>,
  options: Option<T>,
): UseObserveResult<T, undefined>

export function useObserve<T>(
  source: () => Observable<T>,
  options: Option<T>,
  deps: DependencyList,
): UseObserveResult<T, T>

export function useObserve<T, SelectorKeys extends keyof T>(
  source$: Observable<T> | (() => Observable<T> | undefined),
  optionsOrDeps?: Partial<Option<T>> | DependencyList | SelectorKeys[],
  maybeDeps?: DependencyList,
): UseObserveResult<T, T | undefined> {
  const options =
    optionsOrDeps != null && !Array.isArray(optionsOrDeps)
      ? (optionsOrDeps as Partial<Option<T>>)
      : ({
          defaultValue: undefined,
          compareFn: undefined,
        } satisfies Partial<Option<T>>)
  const deps =
    !maybeDeps && Array.isArray(optionsOrDeps)
      ? optionsOrDeps
      : typeof source$ === "function"
        ? (maybeDeps ?? [])
        : [source$]
  const initialDefaultValue = options.defaultValue
  const valueRef = useRef<{ value: T | undefined }>({
    value: initialDefaultValue,
  })
  const sourceRef = useLiveRef(source$)
  const optionsRef = useLiveRef(options)
  const selectorKey =
    typeof source$ !== "function" && Array.isArray(optionsOrDeps)
      ? JSON.stringify(optionsOrDeps)
      : undefined
  const selectorKeys =
    typeof source$ !== "function" && Array.isArray(optionsOrDeps)
      ? (optionsOrDeps as SelectorKeys[])
      : undefined

  const store = useStore<T>(
    {
      source$,
      defaultValue: options.defaultValue,
      selectorKeys,
      compareFn: options.compareFn,
    },
    deps,
  )

  const result = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )

  return result
}
