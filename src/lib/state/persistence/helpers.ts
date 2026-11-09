import { catchError, from, type Observable, of, switchMap } from "rxjs"
import { SIGNAL_RESET } from "../constants"
import type { Adapter } from "./adapters/Adapter"
import { IDENTIFIER_PERSISTENCE_KEY } from "./constants"
import type { PersistenceEntry, SignalPersistenceConfig } from "./types"

const getNormalizedPersistanceValue = (unknownValue: unknown) => {
  if (
    typeof unknownValue === "object" &&
    unknownValue !== null &&
    IDENTIFIER_PERSISTENCE_KEY in unknownValue &&
    unknownValue[IDENTIFIER_PERSISTENCE_KEY] === IDENTIFIER_PERSISTENCE_KEY
  ) {
    return unknownValue as PersistenceEntry
  }

  return undefined
}

export const persistValue = ({
  adapter,
  config,
}: {
  adapter: Adapter
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  config: SignalPersistenceConfig<any>
}) => {
  const { signal, version } = config
  const state = signal.getValue()

  const value = {
    value: state,
    [IDENTIFIER_PERSISTENCE_KEY]: IDENTIFIER_PERSISTENCE_KEY,
    migrationVersion: version,
  } satisfies PersistenceEntry

  if (process.env.NODE_ENV === "development") {
    console.log(
      "[reactjrx][state][persistance]:",
      "Persist value",
      value,
      `for signal ${signal.config.key}`,
    )
  }

  return from(adapter.setItem(signal.config.key, value)).pipe(
    catchError((e) => {
      console.error(e)

      return of(null)
    }),
  )
}

/**
 * Emits `{ value }` with the value the signal was hydrated with, which can be
 * `undefined`, or `undefined` when nothing usable is stored.
 */
export function hydrateValueToSignal({
  adapter,
  config,
  resetToDefault = false,
}: {
  adapter: Adapter
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  config: SignalPersistenceConfig<any>
  /**
   * When nothing usable is stored, reset the signal to its default instead of
   * leaving its current value in place.
   */
  resetToDefault?: boolean
}): Observable<{ value: unknown } | undefined> {
  const { hydrate = ({ value }) => value, signal, version } = config

  const withoutStoredValue = () => {
    if (resetToDefault) signal.update(SIGNAL_RESET)

    return of(undefined)
  }

  return from(adapter.getItem(signal.config.key)).pipe(
    switchMap((value) => {
      const normalizedValue = getNormalizedPersistanceValue(value)

      if (!normalizedValue) return withoutStoredValue()

      const storedVersionIsInvalid =
        typeof normalizedValue.migrationVersion !== "number"

      const signalVersionIsSuperior =
        normalizedValue.migrationVersion !== undefined &&
        version > normalizedValue.migrationVersion

      if (storedVersionIsInvalid || signalVersionIsSuperior) {
        return withoutStoredValue()
      }

      if (process.env.NODE_ENV === "development") {
        console.log(
          "[reactjrx][state][persistance]:",
          "Hydrate value",
          normalizedValue,
          `for signal ${signal.config.key}`,
        )
      }

      const hydratedValue = hydrate({ value: normalizedValue.value, version })

      signal.next(hydratedValue)

      return of({ value: hydratedValue })
    }),
  )
}
