import { expect, it } from "vitest"
import { serializeKey } from "./serializeKey"

it("should return correct serialized key", () => {
  expect(serializeKey([])).toBe("[]")
  expect(serializeKey([5,"foo"])).toBe(`[5,"foo"]`)
  expect(serializeKey(["todos", { status: "foo", page: 2 }])).toBe(
    `["todos",{"page":2,"status":"foo"}]`
  )
  expect(serializeKey(["todos", { page: 2, status: "foo" }])).toBe(
    `["todos",{"page":2,"status":"foo"}]`
  )
  expect(serializeKey(["todos", { page: 2, status: "foo", bar: undefined }])).toBe(
    `["todos",{"page":2,"status":"foo"}]`
  )
})
