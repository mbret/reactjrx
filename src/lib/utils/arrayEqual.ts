// biome-ignore lint/suspicious/noExplicitAny: TODO
export const arrayEqual = <A extends any[], B extends any[]>(a: A, b: B) =>
  a.length === b.length && a.every((v, i) => v === b[i])
