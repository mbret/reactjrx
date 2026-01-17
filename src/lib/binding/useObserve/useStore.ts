import { type DependencyList, useEffect, useRef } from "react"
import type { Observable } from "rxjs"
import { arrayEqual, useLiveRef } from "../../utils"
import { ObservableStore } from "./store"
import type { UseObserveOptions } from "./types"

type StoreReference<T, DefaultValue> = {
  deps: DependencyList
  store: ObservableStore<T, DefaultValue | undefined>
}

/**
 * Mechanism to initialize / retrieve an existing observable store.
 *
 * - We cannot use `useMemo` because it is theoretically not stable. We need stability,
 * not performance optimization.
 * - Using `useState` would make the API not sync (or optimistically return the wrong value).
 * We want the returned value of a render cycle to be derived from the given arguments. `useState`
 * would force us to update the store asynchronously in a useEffect. Losing at least one render cycle.
 * - We are left with using refs to hold the latest references. We use comparison with given deps as well.
 * We are re-creating store during render cycles which is normally not recommended.
 * However this is "okay" since it is to be used inside a useSyncExternalStore and not directly in a render.
 */
export const useStore = <T, DefaultValue>(
  source$: Observable<T> | (() => Observable<T> | undefined),
  options: UseObserveOptions<T, DefaultValue>,
  deps: DependencyList,
): ObservableStore<T, DefaultValue | undefined> => {
  const optionsRef = useLiveRef(options)
  const storeRef = useRef<StoreReference<T, DefaultValue> | undefined>(
    undefined,
  )

  if (!storeRef.current || !arrayEqual([...deps], [...storeRef.current.deps])) {
    storeRef.current = {
      deps,
      store: new ObservableStore({
        source$,
        defaultValue: optionsRef.current.defaultValue,
        compareFn: (a, b) => optionsRef.current?.compareFn?.(a, b) ?? a === b,
      }),
    }
  }

  const store = storeRef.current.store

  useEffect(
    () => () => {
      store.sub.unsubscribe()
    },
    [store],
  )

  return store
}
