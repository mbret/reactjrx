import { useLiveRef } from "../../utils/useLiveRef"
import { useObserve } from "../../binding/useObserve"
import {
  EMPTY,
  asyncScheduler,
  catchError,
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
import { createLocalStorageAdapter } from "./adapters/createLocalStorageAdapter"
import type { Signal } from "../signal"
import { getNormalizedPersistanceValue } from "./getNormalizedPersistanceValue"
import { IDENTIFIER_PERSISTANCE_KEY } from "./constants"

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

const useInvalidateStorage = ({
  adapter,
  entries,
  storageKey
}: {
  entries: {
    current: Array<{ version: number; signal: Signal<any, any, string> }>
  }
  adapter: {
    current: Adapter
  }
  storageKey?: string
}) => {
  useSubscribe(
    () =>
      !storageKey
        ? EMPTY
        : merge(
            ...entries.current.map(({ signal, version }) =>
              persistValue({
                adapter: adapter.current,
                signal,
                version
              })
            )
          ),
    [storageKey]
  )
}

export const usePersistSignals = ({
  entries = [],
  onReady,
  adapter = createLocalStorageAdapter(),
  storageKey
}: {
  entries?: Array<{ version: number; signal: Signal<any, any, string> }>
  onReady?: () => void
  adapter?: Adapter
  /**
   * Can be used to invalidate current storage
   * resulting on a re-persist of all values.
   */
  storageKey?: string
}) => {
  const entriesRef = useLiveRef(entries)
  const onReadyRef = useLiveRef(onReady)
  const adapterRef = useLiveRef(adapter)

  const isHydrated = useObserve(
    () => {
      const entries = entriesRef.current

      const stream =
        entries.length === 0
          ? of(true)
          : zip(
              ...entries.map(({ signal, version }) =>
                hydrateValueToSignal({
                  adapter: adapterRef.current,
                  signal,
                  version
                }).pipe(
                  mergeMap(() =>
                    persistValue({
                      adapter: adapterRef.current,
                      signal,
                      version
                    })
                  )
                )
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
    },
    { defaultValue: false },
    []
  )

  useSubscribe(() => {
    return !isHydrated
      ? EMPTY
      : merge(
          ...entriesRef.current.map(({ signal, version }) =>
            signal.subject.pipe(
              throttleTime(500, asyncScheduler, {
                trailing: true
              }),
              switchMap(() => {
                return from(
                  persistValue({ adapter: adapterRef.current, signal, version })
                )
              })
            )
          )
        )
  }, [isHydrated, adapterRef])

  useInvalidateStorage({ adapter: adapterRef, entries: entriesRef, storageKey })

  return { isHydrated }
}
