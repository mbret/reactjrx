import { type Signal } from "../signal"
import type { IDENTIFIER_PERSISTANCE_KEY } from "./constants"

export interface Adapter {
  getItem: (key: string) => Promise<unknown>
  setItem: (key: string, value: any) => Promise<unknown>
  removeItem: (key: string) => Promise<unknown>
  clear: () => Promise<unknown>
}

export interface PersistanceEntry {
  value: unknown
  migrationVersion?: number
  [IDENTIFIER_PERSISTANCE_KEY]: typeof IDENTIFIER_PERSISTANCE_KEY
}

export interface SignalPersistenceConfig<Value> {
  version: number
  signal: Signal<any, Value, string>
  /**
   * Only called if there is a value to hydrate
   */
  hydrate?: (params: {
    version: number
    value: Value
  }) => Value
}
