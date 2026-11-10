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
    it("should keep both of two overlapping setItem calls", async () => {
      const adapter = createLocalStorageAdapter({ key: "app" })

      await Promise.all([adapter.setItem("a", 1), adapter.setItem("b", 2)])

      expect(JSON.parse(localStorage.getItem("app") ?? "")).toEqual({
        a: 1,
        b: 2,
      })
    })

    it("should read a shared entry that is not JSON as an empty store", async () => {
      localStorage.setItem("app", "not json")
      const adapter = createLocalStorageAdapter({ key: "app" })

      expect(await adapter.getItem("theme")).toBe(undefined)

      await adapter.setItem("theme", "dark")

      expect(await adapter.getItem("theme")).toBe("dark")
    })
  })
})
