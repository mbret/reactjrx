import { describe, expect, it } from "vitest"
import { isPromiseLike } from "./isPromiseLike"
import { makeObservable } from "./makeObservable"

const createThenable = (value: number) => ({
  // biome-ignore lint/suspicious/noThenProperty: intentionally building a non-native thenable
  then(onFulfilled: (value: number) => void) {
    onFulfilled(value)

    return this
  },
  catch() {
    return this
  },
})

describe("isPromiseLike", () => {
  it("returns true for a native promise", () => {
    expect(isPromiseLike(Promise.resolve(1))).toBe(true)
  })

  it("returns true for a non-native thenable with then and catch functions", () => {
    expect(isPromiseLike(createThenable(42))).toBe(true)
  })

  it("returns false for an object whose catch is not a function", () => {
    const notAPromise = {
      // biome-ignore lint/suspicious/noThenProperty: intentionally testing a fake thenable
      then: () => {},
      catch: "function",
    }

    expect(isPromiseLike(notAPromise)).toBe(false)
  })

  it("returns falsy for non promise values", () => {
    expect(isPromiseLike(undefined)).toBeFalsy()
    expect(isPromiseLike(null)).toBeFalsy()
    expect(isPromiseLike(42)).toBeFalsy()
    expect(isPromiseLike({})).toBeFalsy()
    expect(isPromiseLike(() => {})).toBeFalsy()
  })

  it("makes makeObservable emit the resolved value of a thenable, not the thenable itself", () => {
    const thenable = createThenable(42)

    const emitted: unknown[] = []

    makeObservable(thenable)().subscribe((value) => {
      emitted.push(value)
    })

    expect(emitted).toEqual([42])
  })
})
