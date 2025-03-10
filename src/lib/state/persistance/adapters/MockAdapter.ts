import type { Adapter } from "./Adapter"

export class MockAdapter implements Adapter {
  constructor(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public storage: Record<string, any> = {},
    public config = {
      resolve: true,
    },
  ) {}

  getItem(key: string) {
    if (!this.config.resolve) return new Promise(() => {})

    return Promise.resolve(this.storage[key])
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  setItem(_: string, __: any) {
    return new Promise(() => {})
  }

  removeItem(_: string) {
    return new Promise(() => {})
  }

  clear() {
    return new Promise(() => {})
  }
}
