export function isShallowEqual<A, B>(objA: A, objB: B): boolean {
  // Check if both objects are null or undefined
  if (
    objA === null ||
    objB === null ||
    objA === undefined ||
    objB === undefined
  ) {
    return Object.is(objA, objB)
  }

  // Check if both objects are primitives
  if (typeof objA !== "object" || typeof objB !== "object") {
    return Object.is(objA, objB)
  }

  // Check if both objects have the same constructor
  if (!Object.is(objA.constructor, objB.constructor)) {
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
    if (
      !Object.hasOwn(objB, key) ||
      !Object.is(objA[key], (objB as Record<keyof A, unknown>)[key])
    ) {
      return false
    }
  }

  // If all checks pass, the objects are considered shallowly equal
  return true
}
