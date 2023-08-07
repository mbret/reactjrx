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

export const printQuery = (data: any) => {
  return JSON.stringify(sortObj(data), (_, v) =>
    v === undefined ? "__undefined" : v
  ).replace(/"__undefined"/g, "undefined")
}
