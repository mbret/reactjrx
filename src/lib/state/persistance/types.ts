export type Adapter = {
  getItem: (key: string) => Promise<unknown> | unknown
  setItem: (key: string, value: any) => Promise<unknown> | unknown
}

export type PersistanceEntry = {
  value: unknown
  migrationVersion?: number
  __key: "reactjrx_persistance"
}
