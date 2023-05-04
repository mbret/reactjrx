export const serializeKey = (key: any[]) => {
  if (key.length === 0) return ''

  return JSON.stringify(key)
}
