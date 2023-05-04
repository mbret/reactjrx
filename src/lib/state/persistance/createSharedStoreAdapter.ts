import { type Adapter } from "./types"

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
export const createSharedStoreAdapter = ({
  adapter,
  key
}: {
  adapter: Adapter
  key: string
}) => ({
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
