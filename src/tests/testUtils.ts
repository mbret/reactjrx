// biome-ignore lint/suspicious/noExplicitAny: TODO
function sortObj(obj: any) {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      // @ts-expect-error
      result[key] = obj[key]
      return result
    }, {})
}

// biome-ignore lint/suspicious/noExplicitAny: TODO
export const printQuery = (data: any, keys?: string[]) => {
  const match = !keys?.length
    ? data
    : Object.keys(data)
        .filter((key) => keys.includes(key))
        // biome-ignore lint/suspicious/noExplicitAny: TODO
        .reduce<any>((acc, key) => {
          acc[key] = data[key]

          return acc
        }, {})

  return JSON.stringify(sortObj(match), (_, v) =>
    v === undefined ? "__undefined" : v,
  ).replace(/"__undefined"/g, "undefined")
}
