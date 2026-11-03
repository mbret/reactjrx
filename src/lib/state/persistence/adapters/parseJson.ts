/**
 * Parses a stored value. A value that is not JSON counts as nothing stored,
 * so it does not block the hydration.
 */
export const parseJson = (serializedValue: string | null): unknown => {
  if (!serializedValue) return undefined

  try {
    return JSON.parse(serializedValue)
  } catch {
    return undefined
  }
}
