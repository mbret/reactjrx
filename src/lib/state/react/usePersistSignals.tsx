import { useLiveRef } from "../../utils/react/useLiveRef"
import { useObserve } from "../../binding/useObserve"
import { concatMap, NEVER, scan } from "rxjs"
import type { SignalPersistenceConfig } from "../persistance/types"
import { useLiveBehaviorSubject } from "../../binding/useLiveBehaviorSubject"
import { persistSignals } from "../persistance/persistSignals"
import { Adapter } from "../persistance/adapters/Adapter"

/**
 * Make sure to pass stable reference of entries and adapter if you don't
 * intentionally want to start over the process.
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
        concatMap((adapter) => {
          if (!adapter) return NEVER

          return entriesSubject.current.pipe(
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
        })
      )

      return persistence$.pipe(
        scan(
          (acc, event) => {
            if (event.type === "hydrated") return { isHydrated: true }

            return acc
          },
          { isHydrated: false as boolean }
        )
      )
    },
    { defaultValue: { isHydrated: false } },
    [adapterSubject]
  )
}
