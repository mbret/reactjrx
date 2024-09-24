/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { type Adapter } from "./Adapter"

export class MockAdapter implements Adapter {
  constructor(
    public storage: Record<string, any> = {},
    public config = {
      resolve: true
    }
  ) {}

  getItem(key: string) {
    if (!this.config.resolve) return new Promise(() => {})

    return Promise.resolve(this.storage[key])
  }

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
