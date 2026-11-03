import { afterEach, describe, expect, it } from "vitest"
import { createLocalStorageAdapter } from "./createLocalStorageAdapter"

afterEach(() => {
  localStorage.clear()
})

describe("createLocalStorageAdapter", () => {
  it("should read a value that is not JSON as nothing stored", async () => {
    localStorage.setItem("theme", "dark")

    expect(await createLocalStorageAdapter().getItem("theme")).toBe(undefined)
  })

  describe("with a shared key", () => {
    it("should read a shared entry that is not JSON as an empty store", async () => {
      localStorage.setItem("app", "not json")
      const adapter = createLocalStorageAdapter({ key: "app" })

      expect(await adapter.getItem("theme")).toBe(undefined)

      await adapter.setItem("theme", "dark")

      expect(await adapter.getItem("theme")).toBe("dark")
    })
  })
})
