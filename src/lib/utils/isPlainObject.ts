// Copied from: https://github.com/jonschlinkert/is-plain-object

import { hasObjectPrototype } from "./hasObjectPrototype"

// eslint-disable-next-line @typescript-eslint/ban-types
export function isPlainObject(o: any): o is Object {
  if (!hasObjectPrototype(o)) {
    return false
  }

  // If has no constructor
  const ctor = o.constructor
  if (typeof ctor === "undefined") {
    return true
  }

  // If has modified prototype
  const prot = ctor.prototype
  if (!hasObjectPrototype(prot)) {
    return false
  }

  // If constructor does not have an Object-specific method
  // eslint-disable-next-line no-prototype-builtins
  if (!prot.hasOwnProperty("isPrototypeOf")) {
    return false
  }

  // Most likely a plain Object
  return true
}
