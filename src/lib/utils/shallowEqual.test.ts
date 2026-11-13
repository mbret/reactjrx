import { describe, expect, it } from "vitest"
import * as reactjrx from "../../index"
import { isShallowEqual } from "./shallowEqual"

describe("shallowEqual", () => {
  it("is exported by the package", () => {
    expect(reactjrx).toHaveProperty("isShallowEqual", isShallowEqual)
  })

  it("returns true for two null values", () => {
    expect(isShallowEqual(null, null)).toBe(true)
  })

  it("returns true for two undefined values", () => {
    expect(isShallowEqual(undefined, undefined)).toBe(true)
  })

  it("returns false for a null value and an undefined value", () => {
    expect(isShallowEqual(null, undefined)).toBe(false)
  })

  it("compares a null-prototype object with null", () => {
    const value = Object.create(null)
    expect(isShallowEqual(value, null)).toBe(false)
    expect(isShallowEqual(null, value)).toBe(false)
  })

  it("returns true for two string values that are equal", () => {
    expect(isShallowEqual("hello", "hello")).toBe(true)
  })

  it("returns false for two string values that are not equal", () => {
    expect(isShallowEqual("hello", "world")).toBe(false)
  })

  it("returns true for two number values that are equal", () => {
    expect(isShallowEqual(42, 42)).toBe(true)
  })

  it("returns false for two number values that are not equal", () => {
    expect(isShallowEqual(42, 3.14)).toBe(false)
  })

  it("returns true for two boolean values that are equal", () => {
    expect(isShallowEqual(true, true)).toBe(true)
  })

  it("returns false for two boolean values that are not equal", () => {
    expect(isShallowEqual(true, false)).toBe(false)
  })

  it("returns true for two objects with the same properties and values", () => {
    const obj1 = { a: 1, b: "hello", c: true }
    const obj2 = { a: 1, b: "hello", c: true }
    expect(isShallowEqual(obj1, obj2)).toBe(true)
  })

  it("returns false for two objects with different properties", () => {
    const obj1 = { a: 1, b: "hello" }
    const obj2 = { a: 1, c: true }
    expect(isShallowEqual(obj1, obj2)).toBe(false)
  })

  it("returns false for two objects with different property values", () => {
    const obj1 = { a: 1, b: "hello" }
    const obj2 = { a: 1, b: "world" }
    expect(isShallowEqual(obj1, obj2)).toBe(false)
  })

  it("returns false for an object and a primitive value", () => {
    const obj1 = { a: 1, b: "hello" }
    const obj2 = "hello"
    expect(isShallowEqual(obj1, obj2)).toBe(false)
  })

  it("compares null-prototype dictionaries by their own keys", () => {
    const a = Object.assign(Object.create(null), { x: 1 })
    const b = Object.assign(Object.create(null), { x: 1 })
    expect(isShallowEqual(a, b)).toBe(true)
    b.x = 2
    expect(isShallowEqual(a, b)).toBe(false)
  })

  it("handles an own property named hasOwnProperty", () => {
    expect(isShallowEqual({ hasOwnProperty: 1 }, { hasOwnProperty: 1 })).toBe(
      true,
    )
    expect(isShallowEqual({ hasOwnProperty: 1 }, { hasOwnProperty: 2 })).toBe(
      false,
    )
  })

  it("does not mistake inherited keys for own keys", () => {
    const b = Object.assign(Object.create({ x: 1 }), { y: 1 })
    expect(isShallowEqual({ x: 1 }, b)).toBe(false)
  })

  it("considers NaN equal to itself and to another NaN property", () => {
    expect(isShallowEqual(Number.NaN, Number.NaN)).toBe(true)
    expect(isShallowEqual({ x: Number.NaN }, { x: Number.NaN })).toBe(true)
    expect(
      isShallowEqual({ constructor: Number.NaN }, { constructor: Number.NaN }),
    ).toBe(true)
  })

  it("distinguishes positive and negative zero", () => {
    expect(isShallowEqual(0, -0)).toBe(false)
    expect(isShallowEqual(-0, 0)).toBe(false)
    expect(isShallowEqual({ x: 0 }, { x: -0 })).toBe(false)
    expect(isShallowEqual({ x: -0 }, { x: -0 })).toBe(true)
  })

  it("keeps different constructors distinct", () => {
    expect(isShallowEqual(Object.create(null), {})).toBe(false)
    expect(isShallowEqual([], {})).toBe(false)
  })

  it("compares nested objects by reference", () => {
    const value = { x: 1 }
    expect(isShallowEqual({ value }, { value })).toBe(true)
    expect(isShallowEqual({ value }, { value: { x: 1 } })).toBe(false)
  })
})
