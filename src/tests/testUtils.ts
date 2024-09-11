// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortObj(obj: any) {
  return Object.keys(obj)
    .sort()
    .reduce(function (result, key) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore
      result[key] = obj[key]
      return result
    }, {})
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const printQuery = (data: any, keys?: string[]) => {
  const match = !keys?.length
    ? data
    : Object.keys(data)
        .filter((key) => keys.includes(key))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce<any>((acc, key) => {
          acc[key] = data[key]

          return acc
        }, {})

  return JSON.stringify(sortObj(match), (_, v) =>
    v === undefined ? "__undefined" : v
  ).replace(/"__undefined"/g, "undefined")
}
