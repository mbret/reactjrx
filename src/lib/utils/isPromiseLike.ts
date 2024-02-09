export function isPromiseLike(value: any): value is Promise<any> {
  return (
    value instanceof Promise ||
    (value &&
      typeof value.then === "function" &&
      typeof value.catch === "function")
  )
}
