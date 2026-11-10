import type { Signal, SignalValue } from "../Signal"
import type { IDENTIFIER_PERSISTENCE_KEY } from "./constants"

export interface PersistenceEntry {
  value?: unknown
  /**
   * Set when the signal held `undefined`, which JSON drops from `value`. An
   * entry with neither stores nothing, as entries written before this flag
   * do.
   */
  isUndefined?: true
  migrationVersion?: number
  [IDENTIFIER_PERSISTENCE_KEY]: typeof IDENTIFIER_PERSISTENCE_KEY
}

// biome-ignore lint/suspicious/noExplicitAny: TODO
export interface SignalPersistenceConfig<S extends Signal<any, string>> {
  version: number
  signal: S
  /**
   * Turns a stored value into the signal's value, given the `version` it was
   * stored with. It also runs for a value stored with an older version, to
   * migrate it: the result is then saved with this entry's version. Without
   * `hydrate`, a value stored with an older version is discarded.
   *
   * The value is `unknown`, since the storage can hold any shape, and it is
   * `undefined` when the signal was saved holding `undefined`. If `hydrate`
   * throws, the error is logged and the entry hydrates as if nothing usable
   * were stored, but the storage keeps the value until the signal changes.
   */
  hydrate?: (params: { version: number; value: unknown }) => SignalValue<S>
}
