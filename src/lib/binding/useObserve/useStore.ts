import { type DependencyList, useEffect, useId, useMemo } from "react"
import type { Observable } from "rxjs"
import { ObservableStore, storeMap } from "./store"

export const useStore = <T>(
  {
    source$,
    defaultValue,
    selectorKeys,
    compareFn,
  }: {
    source$: Observable<T> | (() => Observable<T> | undefined)
    defaultValue: T | undefined
    selectorKeys: (keyof T)[] | undefined
    compareFn: ((a: T, b: T) => boolean) | undefined
  },
  deps: DependencyList,
): ObservableStore<T> => {
  const id = useId()
  // biome-ignore lint/correctness/useExhaustiveDependencies: Expected
  const key = useMemo(() => JSON.stringify([id, ...deps]), [id, ...deps])

  const store =
    storeMap.get(key) ?? new ObservableStore({ source$, defaultValue, selectorKeys, compareFn })

  useEffect(() => {
    storeMap.set(key, store)

    return () => {
      storeMap.delete(key)
    }
  }, [key, store])

  return store
}
