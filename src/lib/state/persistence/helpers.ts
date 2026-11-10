import { catchError, defer, of } from "rxjs"
import type { Adapter } from "./adapters/Adapter"
import { IDENTIFIER_PERSISTENCE_KEY } from "./constants"
import type { PersistenceEntry, SignalPersistenceConfig } from "./types"

const isPersistenceEntry = (value: unknown): value is PersistenceEntry =>
  typeof value === "object" &&
  value !== null &&
  IDENTIFIER_PERSISTENCE_KEY in value &&
  value[IDENTIFIER_PERSISTENCE_KEY] === IDENTIFIER_PERSISTENCE_KEY

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
    ...(state === undefined ? { isUndefined: true as const } : {}),
    [IDENTIFIER_PERSISTENCE_KEY]: IDENTIFIER_PERSISTENCE_KEY,
    migrationVersion: version,
  } satisfies PersistenceEntry

  return defer(() => adapter.setItem(signal.config.key, value)).pipe(
    catchError((e) => {
      console.error(e)

      return of(null)
    }),
  )
}

/**
 * What the adapter holds for an entry, as the signal's value:
 * - `missing`: nothing usable, or a value of an older version that the entry
 *   has no `hydrate` to migrate;
 * - `unreadable`: a value that `hydrate` threw on;
 * - `migrated`: a value of an older version, migrated by `hydrate`, which the
 *   adapter does not hold yet;
 * - `current`: a value of the entry's version or newer, through `hydrate`
 *   when the entry has one.
 */
export type StoredState =
  | { type: "missing" }
  | { type: "unreadable" }
  | { type: "migrated"; value: unknown }
  | { type: "current"; value: unknown }

export const readStoredState = (
  stored: unknown,
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  { hydrate, signal, version }: SignalPersistenceConfig<any>,
): StoredState => {
  if (!isPersistenceEntry(stored)) return { type: "missing" }

  const { migrationVersion, value, isUndefined } = stored
  const hasValue = value !== undefined || isUndefined

  if (typeof migrationVersion !== "number" || !hasValue) {
    return { type: "missing" }
  }

  const isStoredVersionOlder = migrationVersion < version

  if (isStoredVersionOlder && !hydrate) return { type: "missing" }

  try {
    return {
      type: isStoredVersionOlder ? "migrated" : "current",
      value: hydrate ? hydrate({ value, version: migrationVersion }) : value,
    }
  } catch (error) {
    console.error(`Unable to hydrate signal ${signal.config.key}`, error)

    return { type: "unreadable" }
  }
}
