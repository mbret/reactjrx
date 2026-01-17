import type { Signal, SignalValue } from "../Signal"
import type { IDENTIFIER_PERSISTENCE_KEY } from "./constants"

export interface PersistenceEntry {
  value: unknown
  migrationVersion?: number
  [IDENTIFIER_PERSISTENCE_KEY]: typeof IDENTIFIER_PERSISTENCE_KEY
}

// biome-ignore lint/suspicious/noExplicitAny: TODO
export interface SignalPersistenceConfig<S extends Signal<any, string>> {
  version: number
  signal: S
  /**
   * Only called if there is a value to hydrate
   */
  hydrate?: (params: {
    version: number
    value: SignalValue<S>
  }) => SignalValue<S>
}
