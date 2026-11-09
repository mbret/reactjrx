import type { Signal, SignalValue } from "../Signal"
import type { IDENTIFIER_PERSISTENCE_KEY } from "./constants"

export interface PersistenceEntry {
  /**
   * Missing when the signal held `undefined`, since JSON drops the key.
   */
  value?: unknown
  migrationVersion?: number
  [IDENTIFIER_PERSISTENCE_KEY]: typeof IDENTIFIER_PERSISTENCE_KEY
}

// biome-ignore lint/suspicious/noExplicitAny: TODO
export interface SignalPersistenceConfig<S extends Signal<any, string>> {
  version: number
  signal: S
  /**
   * Called with the stored value when the signal is hydrated from it. The
   * value is `undefined` when the signal was saved holding `undefined`.
   */
  hydrate?: (params: {
    version: number
    value: SignalValue<S>
  }) => SignalValue<S>
}
