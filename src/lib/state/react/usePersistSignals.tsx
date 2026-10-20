import { map, merge, of, switchMap } from "rxjs"
import { useLiveBehaviorSubject } from "../../binding/useLiveBehaviorSubject"
import { useObserve } from "../../binding/useObserve/useObserve"
import { useLiveRef } from "../../utils/react/useLiveRef"
import { isShallowEqual } from "../../utils/shallowEqual"
import type { Adapter } from "../persistence/adapters/Adapter"
import { persistSignals } from "../persistence/persistSignals"
import type { SignalPersistenceConfig } from "../persistence/types"

/**
 * Hydrates the signals of `entries` from `adapter`, then persists their
 * updates to it.
 *
 * `isHydrated` becomes `true` once the entries have been hydrated for the
 * first time. Entries added later do not change it. It is reset when the
 * adapter changes.
 */
export function usePersistSignals({
  entries = [],
  onHydrated,
  adapter,
}: {
  /**
   * Entries are matched by signal, so the array does not need a stable
   * reference. A signal is hydrated when it is added, then persisted while it
   * stays in the list. When it is removed, its pending value is saved and it
   * stops being persisted.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  entries?: Array<SignalPersistenceConfig<any>>
  /**
   * Called once per adapter, when `isHydrated` becomes `true`.
   */
  onHydrated?: () => void
  /**
   * Passing a new adapter reference starts over: pending values are saved to
   * the previous adapter, then every entry is hydrated from the new one. Use a
   * stable reference to avoid infinite loop.
   */
  adapter?: Adapter
}): { isHydrated: boolean } {
  const onHydratedRef = useLiveRef(onHydrated)
  const adapterSubject = useLiveBehaviorSubject(adapter)
  const entriesSubject = useLiveBehaviorSubject(entries)

  const result = useObserve(
    () =>
      adapterSubject.pipe(
        switchMap((adapter) => {
          if (!adapter) return of({ type: "reset" as const })

          return merge(
            of({ type: "reset" as const }),
            persistSignals({
              adapter,
              entries$: entriesSubject,
              onHydrated: () => {
                onHydratedRef.current?.()
              },
            }),
          )
        }),
        map((event) => ({ isHydrated: event.type === "hydrated" })),
      ),
    { defaultValue: { isHydrated: false }, compareFn: isShallowEqual },
    [adapterSubject, entriesSubject],
  )

  return result.data
}
