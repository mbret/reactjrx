export interface Adapter {
  getItem: (key: string) => Promise<unknown>
  setItem: (key: string, value: any) => Promise<unknown>
  removeItem: (key: string) => Promise<unknown>
  clear: () => Promise<unknown>
}
