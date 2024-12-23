import { expect, it } from "vitest"
import { matchKey } from "./matchKey"

it("should compare keys", () => {
  expect(matchKey([], [], { exact: false })).toBe(true)
  expect(matchKey([], [], { exact: true })).toBe(true)
  expect(matchKey([], ["foo"], { exact: false })).toBe(false)
  expect(matchKey(["foo"], [], { exact: false })).toBe(true)
  expect(matchKey(["foo", "bar"], ["foo"], { exact: false })).toBe(true)
  expect(matchKey(["foo"], ["foo", "bar"], { exact: true })).toBe(false)
  expect(matchKey(["foo", "bar"], ["foo"], { exact: false })).toBe(true)
  expect(matchKey(["foo"], ["foo", "bar"], { exact: false })).toBe(false)
  expect(
    matchKey(["foo", { foo: "bar" }], ["foo", { foo: "foo" }], {
      exact: false
    })
  ).toBe(false)
  expect(
    matchKey(["foo", { foo: "bar" }], ["foo", { foo: "bar" }], {
      exact: false
    })
  ).toBe(true)
  expect(
    matchKey(["foo", { foo: "bar" }], ["foo", { foo: "bar" }], {
      exact: true
    })
  ).toBe(true)
})
