import { concatMap, merge, of, scan, switchMap } from "rxjs"
import { useLiveBehaviorSubject } from "../../binding/useLiveBehaviorSubject"
import { useObserve } from "../../binding/useObserve"
import { useLiveRef } from "../../utils/react/useLiveRef"
import { isShallowEqual } from "../../utils/shallowEqual"
import type { Adapter } from "../persistance/adapters/Adapter"
import { persistSignals } from "../persistance/persistSignals"
import type { SignalPersistenceConfig } from "../persistance/types"

/**
 * Make sure to pass stable reference of entries and adapter if you don't
 * intentionally want to start over the process.
 *
 * `isHydrated` will be `true` after the first successful hydration. This value
 * will be reset as soon as the adapter reference changes.
 */
export function usePersistSignals({
  entries = [],
  onHydrated,
  adapter,
}: {
  /**
   * Passing a new list of entries will start over the process
   * once the current one is finished. Use a stable reference to avoid
   * inifite loop.
   */

  // biome-ignore lint/suspicious/noExplicitAny: TODO
  entries?: Array<SignalPersistenceConfig<any>>
  /**
   * Triggered after first successful hydrate
   */
  onHydrated?: () => void
  /**
   * Passing a new adapter reference will start over the process
   * once the current one is finished. Use a stable reference to avoid
   * inifite loop.
   */
  adapter?: Adapter
}): { isHydrated: boolean } {
  const onHydratedRef = useLiveRef(onHydrated)
  const adapterSubject = useLiveBehaviorSubject(adapter)
  const entriesSubject = useLiveBehaviorSubject(entries)

  return useObserve(
    () => {
      const persistence$ = adapterSubject.pipe(
        switchMap((adapter) => {
          if (!adapter) return of({ type: "reset" })

          return merge(
            of({ type: "reset" }),
            entriesSubject.pipe(
              concatMap((entries) =>
                persistSignals({
                  adapter,
                  entries,
                  onHydrated: () => {
                    onHydratedRef.current?.()
                  },
                }),
              ),
            ),
          )
        }),
      )

      return persistence$.pipe(
        scan(
          (acc, event) => {
            if (event.type === "reset") return { isHydrated: false }
            if (event.type === "hydrated") return { isHydrated: true }

            return acc
          },
          { isHydrated: false as boolean },
        ),
      )
    },
    { defaultValue: { isHydrated: false }, compareFn: isShallowEqual },
    [adapterSubject, entriesSubject],
  )
}
