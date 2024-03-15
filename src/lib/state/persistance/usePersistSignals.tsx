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
  mergeMap,
  of,
  switchMap,
  tap,
  throttleTime,
  zip
} from "rxjs"
import { useSubscribe } from "../../binding/useSubscribe"
import type { PersistanceEntry, Adapter } from "./types"
import type { Signal } from "../signal"
import { getNormalizedPersistanceValue } from "./getNormalizedPersistanceValue"
import { IDENTIFIER_PERSISTANCE_KEY } from "./constants"
import { isDefined } from "../../utils/isDefined"
import { useLiveBehaviorSubject } from "../../binding/useLiveBehaviorSubject"

const persistValue = ({
  adapter,
  signal,
  version
}: {
  adapter: Adapter
  signal: Signal<unknown, unknown, string>
  version: number
}) => {
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

const hydrateValueToSignal = ({
  adapter,
  version,
  signal
}: {
  adapter: Adapter
  version: number
  signal: Signal<unknown, unknown, string>
}) => {
  return from(adapter.getItem(signal.config.key)).pipe(
    switchMap((value) => {
      const normalizedValue = getNormalizedPersistanceValue(value)

      if (!normalizedValue) return of(value)

      if (
        normalizedValue.migrationVersion !== undefined &&
        version > normalizedValue.migrationVersion
      ) {
        return of(value)
      }

      signal.setValue(normalizedValue.value)

      return of(value)
    })
  )
}

export const usePersistSignals = ({
  entries = [],
  onReady,
  adapter
}: {
  entries?: Array<{ version: number; signal: Signal<any, any, string> }>
  onReady?: () => void
  /**
   * Requires a stable instance otherwise the hydration
   * process will start again. This is useful when you
   * need to change adapter during runtime.
   */
  adapter?: Adapter
}) => {
  const entriesRef = useLiveRef(entries)
  const onReadyRef = useLiveRef(onReady)
  const adapterSubject = useLiveBehaviorSubject(adapter)

  const isHydrated = useObserve(
    () => {
      const entries = entriesRef.current

      return adapterSubject.current.pipe(
        switchMap((adapterInstance) => {
          if (!adapterInstance) return of(false)

          const stream =
            entries.length === 0
              ? of(true)
              : zip(
                  ...entries.map(({ signal, version }) =>
                    hydrateValueToSignal({
                      adapter: adapterInstance,
                      signal,
                      version
                    }).pipe(
                      mergeMap(() =>
                        persistValue({
                          adapter: adapterInstance,
                          signal,
                          version
                        })
                      )
                    )
                  )
                ).pipe(map(() => true))

          return merge(of(false), stream).pipe(
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
        filter((value) => value),
        switchMap(() => adapterSubject.current),
        filter(isDefined),
        switchMap((adapterInstance) =>
          merge(
            ...entriesRef.current.map(({ signal, version }) =>
              signal.subject.pipe(
                throttleTime(500, asyncScheduler, {
                  trailing: true
                }),
                switchMap(() => {
                  return from(
                    persistValue({
                      adapter: adapterInstance,
                      signal,
                      version
                    })
                  )
                })
              )
            )
          )
        )
      ),
    [isHydratedSubject, adapterSubject]
  )

  return { isHydrated }
}
