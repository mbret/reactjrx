export const createLocalStorageAdapter = (forage: {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}) => ({
  getItem: async (key: string) => {
    const serializedValue = forage.getItem(key)

    if (!serializedValue) return undefined

    return JSON.parse(serializedValue)
  },

  setItem: async (key: string, value: unknown) => {
    forage.setItem(key, JSON.stringify(value))
  }
})
