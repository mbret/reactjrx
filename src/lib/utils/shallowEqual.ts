export function shallowEqual<A, B>(objA: A, objB: B): boolean {
  // Check if both objects are null or undefined
  if (
    objA === null ||
    objA === undefined ||
    objB === null ||
    objB === undefined
  ) {
    return (objA as any) === (objB as any)
  }

  // Check if both objects are primitives
  if (typeof objA !== "object" || typeof objB !== "object") {
    return (objA as any) === (objB as any)
  }

  // Check if both objects have the same prototype
  if (objA.constructor !== objB.constructor) {
    return false
  }

  // Check if both objects have the same keys
  const keysA = Object.keys(objA) as Array<keyof A>
  const keysB = Object.keys(objB) as Array<keyof A>

  if (keysA.length !== keysB.length) {
    return false
  }

  // Check if the values of the keys are equal
  for (const key of keysA) {
    // eslint-disable-next-line no-prototype-builtins
    if (!objB.hasOwnProperty(key) || objA[key] !== (objB as any)[key]) {
      return false
    }
  }

  // If all checks pass, the objects are considered shallowly equal
  return true
}
