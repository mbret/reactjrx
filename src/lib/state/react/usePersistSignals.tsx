import { useLiveRef } from "../../utils/react/useLiveRef"
import { useObserve } from "../../binding/useObserve"
import { concatMap, merge, of, scan, switchMap } from "rxjs"
import type { SignalPersistenceConfig } from "../persistance/types"
import { useLiveBehaviorSubject } from "../../binding/useLiveBehaviorSubject"
import { persistSignals } from "../persistance/persistSignals"
import { Adapter } from "../persistance/adapters/Adapter"
import { shallowEqual } from "../../utils/shallowEqual"

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
  adapter
}: {
  /**
   * Passing a new list of entries will start over the process
   * once the current one is finished. Use a stable reference to avoid
   * inifite loop.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const persistence$ = adapterSubject.current.pipe(
        switchMap((adapter) => {
          if (!adapter) return of({ type: "reset" })

          return merge(
            of({ type: "reset" }),
            entriesSubject.current.pipe(
              concatMap((entries) =>
                persistSignals({
                  adapter,
                  entries,
                  onHydrated: () => {
                    onHydratedRef.current?.()
                  }
                })
              )
            )
          )
        })
      )

      return persistence$.pipe(
        scan(
          (acc, event) => {
            if (event.type === "reset") return { isHydrated: false }
            if (event.type === "hydrated") return { isHydrated: true }

            return acc
          },
          { isHydrated: false as boolean }
        )
      )
    },
    { defaultValue: { isHydrated: false }, compareFn: shallowEqual },
    [adapterSubject, entriesSubject]
  )
}
