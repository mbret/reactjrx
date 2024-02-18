import { describe, expect, it } from "vitest"
import { partialMatchKey } from "./partialMatchKey"

describe("partialMatchKey", () => {
  it("should return `true` if a includes b", () => {
    const a = [{ a: { b: "b" }, c: "c", d: [{ d: "d " }] }]
    const b = [{ a: { b: "b" }, c: "c", d: [] }]
    expect(partialMatchKey(a, b)).toEqual(true)
  })

  it("should return `false` if a does not include b", () => {
    const a = [{ a: { b: "b" }, c: "c", d: [] }]
    const b = [{ a: { b: "b" }, c: "c", d: [{ d: "d " }] }]
    expect(partialMatchKey(a, b)).toEqual(false)
  })

  it("should return `true` if array a includes array b", () => {
    const a = [1, 2, 3]
    const b = [1, 2]
    expect(partialMatchKey(a, b)).toEqual(true)
  })

  it("should return `false` if a is null and b is not", () => {
    const a = [null]
    const b = [{ a: { b: "b" }, c: "c", d: [{ d: "d " }] }]
    expect(partialMatchKey(a, b)).toEqual(false)
  })

  it("should return `false` if a contains null and b is not", () => {
    const a = [{ a: null, c: "c", d: [] }]
    const b = [{ a: { b: "b" }, c: "c", d: [{ d: "d " }] }]
    expect(partialMatchKey(a, b)).toEqual(false)
  })

  it("should return `false` if b is null and a is not", () => {
    const a = [{ a: { b: "b" }, c: "c", d: [] }]
    const b = [null]
    expect(partialMatchKey(a, b)).toEqual(false)
  })

  it("should return `false` if b contains null and a is not", () => {
    const a = [{ a: { b: "b" }, c: "c", d: [] }]
    const b = [{ a: null, c: "c", d: [{ d: "d " }] }]
    expect(partialMatchKey(a, b)).toEqual(false)
  })
})
