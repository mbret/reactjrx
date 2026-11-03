import type { Adapter } from "./Adapter"
import { parseJson } from "./parseJson"

type Store = Record<string, unknown>

const isStore = (value: unknown): value is Store =>
  typeof value === "object" && value !== null

const readStore = (key: string): Store => {
  const store = parseJson(localStorage.getItem(key))

  return isStore(store) ? store : {}
}

const writeStore = (key: string, store: Store) => {
  localStorage.setItem(key, JSON.stringify(store))
}

/**
 * Create an adapter which use one unique store entry to store all
 * state. When using many signals it can help with maintenance to keep things
 * tidy.
 *
 * Each call reads and writes the entry synchronously, with no `await` in
 * between, so two calls that overlap do not lose a write.
 */
const createSharedStoreAdapter = (key: string): Adapter => ({
  clear: async () => {
    localStorage.removeItem(key)
  },

  removeItem: async (keyToDelete) => {
    const { [keyToDelete]: _removed, ...rest } = readStore(key)

    writeStore(key, rest)
  },

  getItem: async (itemKey: string) => {
    const store = readStore(key)

    return Object.hasOwn(store, itemKey) ? store[itemKey] : undefined
  },

  setItem: async (itemKey: string, value: unknown) => {
    writeStore(key, { ...readStore(key), [itemKey]: value })
  },
})

export const createLocalStorageAdapter = ({
  key,
}: {
  key?: string
} = {}): Adapter => {
  if (key) {
    return createSharedStoreAdapter(key)
  }

  return {
    clear: async () => {
      localStorage.clear()
    },

    removeItem: async (key) => {
      localStorage.removeItem(key)
    },

    getItem: async (key) => parseJson(localStorage.getItem(key)),

    setItem: async (key, value) => {
      localStorage.setItem(key, JSON.stringify(value))
    },
  }
}
