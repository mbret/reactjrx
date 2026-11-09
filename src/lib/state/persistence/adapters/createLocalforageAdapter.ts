import type { Adapter } from "./Adapter"
import { parseJson } from "./parseJson"

export const createLocalforageAdapter = (forage: {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<string>
}): Adapter => ({
  getItem: async (key: string) => parseJson(await forage.getItem(key)),

  setItem: async (key: string, value: unknown) => {
    await forage.setItem(key, JSON.stringify(value))
  },
})
