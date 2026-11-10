/**
 * Where the persistence reads and writes the values of its signals.
 */
export interface Adapter {
  getItem: (key: string) => Promise<unknown>
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  setItem: (key: string, value: any) => Promise<unknown>
}
