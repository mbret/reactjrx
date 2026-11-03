import { describe, expect, it } from "vitest"
import { arrayEqual } from "./arrayEqual"

describe("arrayEqual", () => {
  it("should compare the items at each index", () => {
    expect(arrayEqual([1, 2], [1, 2])).toBe(true)
    expect(arrayEqual([1, 2], [2, 1])).toBe(false)
    expect(arrayEqual([1], [1, 2])).toBe(false)
  })

  it("should compare the holes of a sparse array too", () => {
    expect(arrayEqual(new Array<number>(1), [1])).toBe(false)
    expect(arrayEqual([1], new Array<number>(1))).toBe(false)
  })
})
