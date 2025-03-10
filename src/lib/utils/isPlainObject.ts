// Copied from: https://github.com/jonschlinkert/is-plain-object

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function hasObjectPrototype(o: any): boolean {
  return Object.prototype.toString.call(o) === "[object Object]"
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
// biome-ignore lint/complexity/noBannedTypes: <explanation>
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
  // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
  if (!prot.hasOwnProperty("isPrototypeOf")) {
    return false
  }

  // Most likely a plain Object
  return true
}
