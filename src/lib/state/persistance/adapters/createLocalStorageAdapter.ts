import { type Adapter } from "../types"

const normalizeStore = (store: unknown) => {
  if (!store || typeof store !== "object") {
    return undefined
  }

  return store
}

/**
 * Create an adapter which use one unique store entry to store all
 * state. When using many signals it can help with maintenance to keep things
 * tidy.
 */
const createSharedStoreAdapter = ({
  adapter,
  key
}: {
  adapter: Adapter
  key: string
}): Adapter => ({
  clear: async () => {
    return await adapter.removeItem(key)
  },

  removeItem: async (keyToDelete) => {
    const unsafeStore = await adapter.getItem(key)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [keyToDelete]: toRemove, ...rest } =
      normalizeStore(unsafeStore) ?? ({} as any)

    await adapter.setItem(key, rest)
  },

  getItem: async (itemKey: string) => {
    const unsafeStore = await adapter.getItem(key)
    const store = normalizeStore(unsafeStore) ?? {}

    if (itemKey in store) {
      return store[itemKey as keyof typeof store]
    }

    return undefined
  },

  setItem: async (itemKey: string, value: unknown) => {
    const unsafeStore = await adapter.getItem(key)
    const store = normalizeStore(unsafeStore) ?? {}

    await adapter.setItem(key, { ...store, [itemKey]: value })
  }
})

export const createLocalStorageAdapter = ({
  key
}: { key?: string } = {}): Adapter => {
  if (key) {
    return createSharedStoreAdapter({
      adapter: createLocalStorageAdapter(),
      key
    })
  }

  return {
    clear: async () => {
      localStorage.clear()
    },

    removeItem: async (key) => {
      localStorage.removeItem(key)
    },

    getItem: async (key) => {
      const serializedValue = localStorage.getItem(key)

      if (!serializedValue) return undefined

      return JSON.parse(serializedValue)
    },

    setItem: async (key, value) => {
      localStorage.setItem(key, JSON.stringify(value))
    }
  }
}
