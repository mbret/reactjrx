import { expect, it } from "vitest"
import { compareKeys } from "./compareKeys"

it("should compare keys", () => {
  expect(compareKeys([], [], { exact: false })).toBe(true)
  expect(compareKeys([], [], { exact: true })).toBe(true)
  expect(compareKeys([], ["foo"], { exact: false })).toBe(true)
  expect(
    compareKeys(["foo", undefined], ["foo", "bar"], { exact: false })
  ).toBe(true)
  expect(
    compareKeys(["foo", undefined, undefined], ["foo", "bar"], { exact: false })
  ).toBe(true)
  expect(
    compareKeys(["foo", undefined, undefined, undefined], ["foo", "bar"], {
      exact: false
    })
  ).toBe(true)
  expect(compareKeys(["foo"], ["foo", "bar"], { exact: true })).toBe(false)
  expect(compareKeys(["foo"], ["foo", "bar"], { exact: false })).toBe(true)
  expect(compareKeys(["foo", "bar"], ["foo"], { exact: false })).toBe(false)
  expect(
    compareKeys(["foo", { foo: "bar" }], ["foo", { foo: "foo" }], {
      exact: false
    })
  ).toBe(false)
  expect(
    compareKeys(["foo", { foo: "bar" }], ["foo", { foo: "bar" }], {
      exact: false
    })
  ).toBe(true)
  expect(
    compareKeys(["foo", { foo: "bar" }], ["foo", { foo: "bar" }], {
      exact: true
    })
  ).toBe(true)
})
