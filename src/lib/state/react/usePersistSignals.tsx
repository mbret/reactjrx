import { map, merge, of, scan, switchMap } from "rxjs"
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
   * the previous adapter, then every entry takes the value stored in the new
   * one. When nothing is stored, or only an older version, the entry goes
   * back to its default once the hook has had two different adapters, so it
   * never carries another adapter's value over (another profile's, for
   * example). Before that, including when the same adapter comes back after
   * a gap without adapter, it keeps its current value. Adapters are compared
   * by reference: a new object for the same storage counts as a different
   * adapter. Use a stable reference to avoid infinite loop.
   */
  adapter?: Adapter
}): { isHydrated: boolean } {
  const onHydratedRef = useLiveRef(onHydrated)
  const adapterSubject = useLiveBehaviorSubject(adapter)
  const entriesSubject = useLiveBehaviorSubject(entries)

  const result = useObserve(
    () =>
      adapterSubject.pipe(
        /**
         * Becomes true once a second, different adapter is passed, and stays
         * true: from then on, a value in memory may come from another adapter
         * than the current one. The same adapter coming back after a gap
         * without adapter (a sign-out, for example) is not a different one.
         */
        scan(
          (previous, adapter) => {
            const firstAdapter = previous.firstAdapter ?? adapter

            return {
              adapter,
              firstAdapter,
              replacesAnother:
                previous.replacesAnother ||
                (!!adapter && adapter !== firstAdapter),
            }
          },
          {
            adapter: undefined as Adapter | undefined,
            firstAdapter: undefined as Adapter | undefined,
            replacesAnother: false,
          },
        ),
        switchMap(({ adapter, replacesAnother }) => {
          if (!adapter) return of({ type: "reset" as const })

          return merge(
            of({ type: "reset" as const }),
            persistSignals({
              adapter,
              entries$: entriesSubject,
              resetToDefault: replacesAnother,
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
