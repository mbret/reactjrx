export const printQuery = (data: any) =>
  JSON.stringify(data, (_, v) => (v === undefined ? "__undefined" : v)).replace(
    /"__undefined"/g,
    "undefined"
  )
