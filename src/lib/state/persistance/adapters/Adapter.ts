export interface Adapter {
  getItem: (key: string) => Promise<unknown>
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  setItem: (key: string, value: any) => Promise<unknown>
  removeItem: (key: string) => Promise<unknown>
  clear: () => Promise<unknown>
}
