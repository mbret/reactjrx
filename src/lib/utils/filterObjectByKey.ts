export function filterObjectByKey<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  return keys.reduce(
    (acc, key) => {
      if (key in obj) {
        // biome-ignore lint/performance/noAccumulatingSpread: TODO
        return { ...acc, [key]: obj[key] }
      }
      return acc
    },
    {} as Pick<T, K>,
  )
}
