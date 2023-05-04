export interface Adapter {
  getItem: (key: string) => Promise<unknown> | unknown
  setItem: (key: string, value: any) => Promise<unknown> | unknown
}

export interface PersistanceEntry {
  value: unknown
  migrationVersion?: number
  __key: 'reactjrx_persistance'
}
