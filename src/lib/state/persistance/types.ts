import type { Signal, SignalValue } from "../Signal"
import type { IDENTIFIER_PERSISTANCE_KEY } from "./constants"

export interface PersistanceEntry {
  value: unknown
  migrationVersion?: number
  [IDENTIFIER_PERSISTANCE_KEY]: typeof IDENTIFIER_PERSISTANCE_KEY
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
