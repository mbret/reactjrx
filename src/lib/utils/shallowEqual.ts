export function shallowEqual(objA: any, objB: any): boolean {
  // Check if both objects are null or undefined
  if (
    objA === null ||
    objA === undefined ||
    objB === null ||
    objB === undefined
  ) {
    return objA === objB
  }

  // Check if both objects are primitives
  if (typeof objA !== "object" || typeof objB !== "object") {
    return objA === objB
  }

  // Check if both objects have the same prototype
  if (objA.constructor !== objB.constructor) {
    return false
  }

  // Check if both objects have the same keys
  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)
  if (keysA.length !== keysB.length) {
    return false
  }

  // Check if the values of the keys are equal
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i]
    if (key && objA[key] !== objB[key]) {
      return false
    }
  }

  // If all checks pass, the objects are considered shallowly equal
  return true
}
