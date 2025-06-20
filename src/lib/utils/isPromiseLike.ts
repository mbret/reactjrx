// biome-ignore lint/suspicious/noExplicitAny: TODO
export function isPromiseLike<T>(value: T): value is T & Promise<any> {
  return (
    value instanceof Promise ||
    (value &&
      typeof value === "object" &&
      "then" in value &&
      typeof value.then === "function" &&
      "catch" in value &&
      value.catch === "function")
  )
}
