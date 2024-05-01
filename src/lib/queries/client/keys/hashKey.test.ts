import { expect, it } from "vitest"
import { hashKey } from "./hashKey"

it("should return correct serialized key", () => {
  expect(hashKey([])).toBe("[]")
  expect(hashKey([5, "foo"])).toBe(`[5,"foo"]`)
  expect(hashKey(["todos", { status: "foo", page: 2 }])).toBe(
    `["todos",{"page":2,"status":"foo"}]`
  )
  expect(hashKey(["todos", { page: 2, status: "foo" }])).toBe(
    `["todos",{"page":2,"status":"foo"}]`
  )
  expect(hashKey(["todos", { page: 2, status: "foo", bar: undefined }])).toBe(
    `["todos",{"page":2,"status":"foo"}]`
  )
})
