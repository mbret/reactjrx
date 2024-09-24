import {
  EMPTY,
  asyncScheduler,
  catchError,
  from,
  map,
  merge,
  of,
  share,
  switchMap,
  tap,
  throttleTime,
  zip
} from "rxjs"
import type { SignalPersistenceConfig } from "./types"
import { Signal } from "../signal"
import { Adapter } from "./adapters/Adapter"
import { hydrateValueToSignal, persistValue } from "./helpers"

export function persistSignals({
  entries = [],
  onHydrated,
  adapter
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entries: Array<SignalPersistenceConfig<Signal<any, any, string>>>
  /**
   * Triggered after first successful hydrate
   */
  onHydrated?: () => void
  /**
   * Requires a stable instance otherwise the hydration
   * process will start again. This is useful when you
   * need to change adapter during runtime.
   */
  adapter: Adapter
}) {
  const signalsHydrated$ =
    entries.length === 0
      ? of([])
      : zip(
          ...entries.map((config) =>
            hydrateValueToSignal({
              adapter,
              config
            })
          )
        )

  const isHydrated$ = signalsHydrated$.pipe(
    tap(onHydrated),
    catchError((error) => {
      console.error("Unable to hydrate", error)

      return EMPTY
    }),
    share()
  )

  /**
   * Start persisting to the current adapter
   * as soon as signals are hydrated. Will stop
   * whenever hydration process starts again
   */
  const persisted$ = isHydrated$.pipe(
    switchMap(() =>
      merge(
        ...entries.map((config) =>
          config.signal.subject.pipe(
            throttleTime(500, asyncScheduler, {
              trailing: true
            }),
            switchMap(() =>
              from(
                persistValue({
                  adapter,
                  config
                })
              )
            )
          )
        )
      )
    )
  )

  return merge(
    isHydrated$.pipe(
      map(() => ({
        type: "hydrated" as const
      }))
    ),
    persisted$.pipe(
      map(() => ({
        type: "persisted" as const
      }))
    )
  )
}
