import {
  asyncScheduler,
  catchError,
  EMPTY,
  filter,
  finalize,
  Observable,
  Subscription,
  switchMap,
  tap,
  throttleTime,
} from "rxjs"
import type { Signal } from "../Signal"
import type { Adapter } from "./adapters/Adapter"
import { hydrateValueToSignal, persistValue } from "./helpers"
import type { SignalPersistenceConfig } from "./types"

// biome-ignore lint/suspicious/noExplicitAny: TODO
type AnySignal = Signal<any, string>
type Entry = SignalPersistenceConfig<AnySignal>

/**
 * Hydrates one signal from the adapter, then persists its updates (at most
 * every 500 ms) until unsubscribed. On unsubscribe, a value still held by the
 * throttle is saved right away instead of being dropped.
 *
 * The signal replays the value it was hydrated with, and that replay is not
 * written back: the write would tag the value with this entry's version,
 * which can be older than the stored one, and a newer app would then discard
 * it. So a change made in place to the hydrated object before the
 * persistence subscribes, in `onHydrated` for example, is saved only once the
 * signal changes again.
 *
 * `entry.config` is read at every write, so a changed config (e.g. a new
 * `version`) applies to the next write.
 */
const hydrateAndPersistEntry = ({
  adapter,
  entry,
  resetToDefault,
  onHydrated,
}: {
  adapter: Adapter
  entry: { config: Entry }
  resetToDefault: boolean
  onHydrated: () => void
}) => {
  const { signal } = entry.config

  return hydrateValueToSignal({
    adapter,
    config: entry.config,
    resetToDefault,
  }).pipe(
    catchError((error) => {
      console.error(`Unable to hydrate signal ${signal.config.key}`, error)

      return EMPTY
    }),
    tap(onHydrated),
    switchMap((hydratedValue) => {
      let lastPersistedValue = hydratedValue

      const persist = () => {
        lastPersistedValue = signal.getValue()

        return persistValue({ adapter, config: entry.config })
      }

      return signal.pipe(
        throttleTime(500, asyncScheduler, {
          trailing: true,
        }),
        filter((value, index) => index > 0 || !Object.is(value, hydratedValue)),
        switchMap(persist),
        finalize(() => {
          if (!Object.is(signal.getValue(), lastPersistedValue)) {
            persist().subscribe()
          }
        }),
      )
    }),
  )
}

/**
 * Hydrates the signals of the latest `entries$` list from the adapter, then
 * persists their updates to it. Entries are matched by signal, so a new array
 * holding the same signals changes nothing:
 * - an added signal is hydrated, then persisted;
 * - a signal still in the list keeps running untouched;
 * - a removed signal stops being persisted, after its pending value is saved.
 *
 * Emits `{ type: "hydrated" }` once, the first time every entry added so far
 * has been hydrated (right away for an empty list). An entry that fails to
 * hydrate is logged and never persisted, and holds back that emission until
 * it is removed.
 */
export function persistSignals({
  entries$,
  onHydrated,
  adapter,
  resetToDefault = false,
}: {
  entries$: Observable<Entry[]>
  /**
   * Called when `{ type: "hydrated" }` is emitted.
   */
  onHydrated?: () => void
  adapter: Adapter
  /**
   * When true, an entry with nothing usable stored goes back to its default
   * instead of keeping its current value.
   */
  resetToDefault?: boolean
}) {
  return new Observable<{ type: "hydrated" }>((subscriber) => {
    const running = new Map<
      AnySignal,
      { config: Entry; subscription: Subscription }
    >()
    const hydrating = new Set<AnySignal>()
    let isUpdatingEntries = false
    let isHydrated = false

    const notifyIfHydrated = () => {
      if (isHydrated || isUpdatingEntries || hydrating.size > 0) return

      isHydrated = true
      onHydrated?.()
      subscriber.next({ type: "hydrated" })
    }

    const start = (config: Entry) => {
      const entry = { config, subscription: new Subscription() }

      running.set(config.signal, entry)
      hydrating.add(config.signal)

      entry.subscription.add(
        hydrateAndPersistEntry({
          adapter,
          entry,
          resetToDefault,
          onHydrated: () => {
            hydrating.delete(config.signal)
            notifyIfHydrated()
          },
        }).subscribe(),
      )
    }

    const stop = (signal: AnySignal) => {
      const entry = running.get(signal)

      if (!entry) return

      running.delete(signal)
      hydrating.delete(signal)
      entry.subscription.unsubscribe()
    }

    const entriesSubscription = entries$.subscribe({
      next: (entries) => {
        isUpdatingEntries = true

        const signals = new Set(entries.map(({ signal }) => signal))

        for (const signal of [...running.keys()]) {
          if (!signals.has(signal)) stop(signal)
        }

        for (const config of entries) {
          const entry = running.get(config.signal)

          if (entry) {
            entry.config = config
          } else {
            start(config)
          }
        }

        isUpdatingEntries = false
        notifyIfHydrated()
      },
      error: (error) => subscriber.error(error),
    })

    return () => {
      entriesSubscription.unsubscribe()

      for (const signal of [...running.keys()]) {
        stop(signal)
      }
    }
  })
}
