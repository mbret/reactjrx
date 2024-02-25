export const createLocalStorageAdapter = () => ({
  getItem: async (key: string) => {
    const serializedValue = localStorage.getItem(key)

    if (!serializedValue) return undefined

    return JSON.parse(serializedValue)
  },

  setItem: async (key: string, value: unknown) => {
    localStorage.setItem(key, JSON.stringify(value))
  }
})
