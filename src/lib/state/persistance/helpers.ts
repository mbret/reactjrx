import { from, catchError, of, switchMap } from "rxjs"
import { Adapter } from "./adapters/Adapter"
import { IDENTIFIER_PERSISTANCE_KEY } from "./constants"
import { SignalPersistenceConfig, PersistanceEntry } from "./types"

export const getNormalizedPersistanceValue = (unknownValue: unknown) => {
  if (
    typeof unknownValue === "object" &&
    unknownValue !== null &&
    IDENTIFIER_PERSISTANCE_KEY in unknownValue &&
    unknownValue[IDENTIFIER_PERSISTANCE_KEY] === IDENTIFIER_PERSISTANCE_KEY
  ) {
    return unknownValue as PersistanceEntry
  }

  return undefined
}

export const persistValue = ({
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

  if (process.env.NODE_ENV === "development") {
    console.log(
      "[reactjrx][state][persistance]:",
      `Persist value`,
      value,
      `for signal ${signal.config.key}`
    )
  }

  return from(adapter.setItem(signal.config.key, value)).pipe(
    catchError((e) => {
      console.error(e)

      return of(null)
    })
  )
}

export function hydrateValueToSignal({
  adapter,
  config
}: {
  adapter: Adapter
  config: SignalPersistenceConfig<any>
}) {
  const { hydrate = ({ value }) => value, signal, version } = config

  return from(adapter.getItem(signal.config.key)).pipe(
    switchMap((value) => {
      const normalizedValue = getNormalizedPersistanceValue(value)

      if (!normalizedValue) return of(value)

      const storedVersionIsInvalid =
        typeof normalizedValue.migrationVersion !== "number"

      const signalVersionIsSuperior =
        normalizedValue.migrationVersion !== undefined &&
        version > normalizedValue.migrationVersion

      if (
        storedVersionIsInvalid ||
        signalVersionIsSuperior ||
        normalizedValue.value === undefined
      ) {
        return of(value)
      }

      const correctVersionValue = normalizedValue.value

      if (process.env.NODE_ENV === "development") {
        console.log(
          "[reactjrx][state][persistance]:",
          `Hydrate value`,
          normalizedValue,
          `for signal ${signal.config.key}`
        )
      }

      signal.setValue(hydrate({ value: correctVersionValue, version }))

      return of(value)
    })
  )
}
