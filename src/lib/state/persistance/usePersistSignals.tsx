import { useLiveRef } from "../../utils/useLiveRef"
import { useObserve } from "../../binding/useObserve"
import {
  EMPTY,
  asyncScheduler,
  catchError,
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
import type { PersistanceEntry, Adapter } from "./types"
import { createLocalStorageAdapter } from "./adapters/createLocalStorageAdapter"
import type { Signal } from "../signal"
import { getNormalizedPersistanceValue } from "./getNormalizedPersistanceValue"
import { IDENTIFIER_PERSISTANCE_KEY } from "./constants"

const persistValue = async ({
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

  await adapter.setItem(signal.config.key, value)
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

      signal.setValue((value as any).value)

      return of(value)
    })
  )
}

export const usePersistSignals = ({
  entries = [],
  onReady,
  adapter = createLocalStorageAdapter(localStorage)
}: {
  entries?: Array<{ version: number; signal: Signal<any, any, string> }>
  onReady?: () => void
  adapter?: Adapter
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
              switchMap(() =>
                from(
                  persistValue({ adapter: adapterRef.current, signal, version })
                )
              )
            )
          )
        )
  }, [isHydrated, adapterRef])

  return { isHydrated }
}
