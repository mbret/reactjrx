export function primitiveEqual<A extends any, B extends any> (
  objA: A,
  objB: B
): boolean {
  if (typeof objA === 'string' && objA === objB) return true
  if (typeof objA === 'number' && objA === objB) return true
  if (typeof objA === 'boolean' && objA === objB) return true
  if (typeof objA === 'symbol' && objA === objB) return true
  if (typeof objA === 'bigint' && objA === objB) return true
  if (typeof objA === 'undefined' && objA === objB) return true
  // @ts-expect-error
  if (objA === null && objA === objB) return true

  return false
}
