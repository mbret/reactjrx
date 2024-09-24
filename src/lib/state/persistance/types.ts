import { type SignalValue, type Signal } from "../signal"
import type { IDENTIFIER_PERSISTANCE_KEY } from "./constants"

export interface PersistanceEntry {
  value: unknown
  migrationVersion?: number
  [IDENTIFIER_PERSISTANCE_KEY]: typeof IDENTIFIER_PERSISTANCE_KEY
}

export interface SignalPersistenceConfig<S extends Signal<any, any, string>> {
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
