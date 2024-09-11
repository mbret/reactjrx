import { isPlainArray } from "./isPlainArray"
import { isPlainObject } from "./isPlainObject"

/**
 * This function returns `a` if `b` is deeply equal.
 * If not, it will replace any deeply equal children of `b` with those of `a`.
 * This can be used for structural sharing between JSON values for example.
 */
export function replaceEqualDeep<T>(a: unknown, b: T): T
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function replaceEqualDeep(a: any, b: any): any {
  if (a === b) {
    return a
  }

  const array = isPlainArray(a) && isPlainArray(b)

  if (array || (isPlainObject(a) && isPlainObject(b))) {
    const aItems = array ? a : Object.keys(a)
    const aSize = aItems.length
    const bItems = array ? b : Object.keys(b)
    const bSize = bItems.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const copy: any = array ? [] : {}

    let equalItems = 0

    for (let i = 0; i < bSize; i++) {
      const key = array ? i : bItems[i]
      if (
        !array &&
        a[key] === undefined &&
        b[key] === undefined &&
        aItems.includes(key)
      ) {
        copy[key] = undefined
        equalItems++
      } else {
        copy[key] = replaceEqualDeep(a[key], b[key])
        if (copy[key] === a[key] && a[key] !== undefined) {
          equalItems++
        }
      }
    }

    return aSize === bSize && equalItems === aSize ? a : copy
  }

  return b
}
