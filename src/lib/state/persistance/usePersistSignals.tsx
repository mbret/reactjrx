import { useLiveRef } from "../../utils/useLiveRef"
import { useObserve } from "../../binding/useObserve"
import {
  EMPTY,
  asyncScheduler,
  catchError,
  filter,
  from,
  map,
  merge,
  of,
  switchMap,
  tap,
  throttleTime,
  zip
} from "rxjs"
import { useSubscribe } from "../../binding/useSubscribe"
import type {
  PersistanceEntry,
  Adapter,
  SignalPersistenceConfig
} from "./types"
import { getNormalizedPersistanceValue } from "./getNormalizedPersistanceValue"
import { IDENTIFIER_PERSISTANCE_KEY } from "./constants"
import { isDefined } from "../../utils/isDefined"
import { useLiveBehaviorSubject } from "../../binding/useLiveBehaviorSubject"

const persistValue = ({
  adapter,
  config
}: {
  adapter: Adapter
  config: SignalPersistenceConfig<any>
}) => {
  const { signal, version } = config
  const state = signal.getValue()

  const value = {
    value: state,
    [IDENTIFIER_PERSISTANCE_KEY]: IDENTIFIER_PERSISTANCE_KEY,
    migrationVersion: version
  } satisfies PersistanceEntry

  return from(adapter.setItem(signal.config.key, value)).pipe(
    catchError((e) => {
      console.error(e)

      return of(null)
    })
  )
}

function hydrateValueToSignal<Value>({
  adapter,
  config
}: {
  adapter: Adapter
  config: SignalPersistenceConfig<Value>
}) {
  const { hydrate = ({ value }) => value, signal, version } = config

  return from(adapter.getItem(signal.config.key)).pipe(
    switchMap((value) => {
      const normalizedValue = getNormalizedPersistanceValue(value)

      if (!normalizedValue) return of(value)

      if (
        (normalizedValue.migrationVersion !== undefined &&
          version > normalizedValue.migrationVersion) ||
        normalizedValue.value === undefined
      ) {
        return of(value)
      }

      const correctVersionValue = normalizedValue.value as Value

      signal.setValue(hydrate({ value: correctVersionValue, version }))

      return of(value)
    })
  )
}

export function usePersistSignals({
  entries = [],
  onReady,
  adapter
}: {
  entries?: Array<SignalPersistenceConfig<any>>
  /**
   * Triggered after first successful hydrate
   */
  onReady?: () => void
  /**
   * Requires a stable instance otherwise the hydration
   * process will start again. This is useful when you
   * need to change adapter during runtime.
   */
  adapter: Adapter
}) {
  const entriesRef = useLiveRef(entries)
  const onReadyRef = useLiveRef(onReady)
  const adapterSubject = useLiveBehaviorSubject(adapter)

  const isHydrated = useObserve(
    () => {
      const entries = entriesRef.current

      return adapterSubject.current.pipe(
        switchMap((adapterInstance) => {
          const stream =
            entries.length === 0
              ? of(true)
              : zip(
                  ...entries.map((config) =>
                    hydrateValueToSignal({
                      adapter: adapterInstance,
                      config
                    })
                  )
                ).pipe(map(() => true))

          return stream.pipe(
            tap(() => {
              if (onReadyRef.current != null) onReadyRef.current()
            }),
            catchError((error) => {
              console.error("Unable to hydrate", error)

              return EMPTY
            })
          )
        })
      )
    },
    { defaultValue: false },
    [adapterSubject, entriesRef]
  )

  const isHydratedSubject = useLiveBehaviorSubject(isHydrated)

  /**
   * Start persisting to the current adapter
   * as soon as signals are hydrated. Will stop
   * whenever hydration process starts again
   */
  useSubscribe(
    () =>
      isHydratedSubject.current.pipe(
        filter((isHydrated) => isHydrated),
        switchMap(() => adapterSubject.current),
        filter(isDefined),
        switchMap((adapterInstance) =>
          merge(
            ...entriesRef.current.map((config) =>
              config.signal.subject.pipe(
                throttleTime(500, asyncScheduler, {
                  trailing: true
                }),
                switchMap(() =>
                  from(
                    persistValue({
                      adapter: adapterInstance,
                      config
                    })
                  )
                )
              )
            )
          )
        )
      ),
    [isHydratedSubject, adapterSubject]
  )

  return { isHydrated }
}
