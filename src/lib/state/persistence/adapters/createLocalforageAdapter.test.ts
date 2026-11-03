import { describe, expect, it } from "vitest"
import { createLocalforageAdapter } from "./createLocalforageAdapter"

describe("createLocalforageAdapter", () => {
  it("should read a value that is not JSON as nothing stored", async () => {
    const adapter = createLocalforageAdapter({
      getItem: async () => "dark",
      setItem: async (_, value) => value,
    })

    expect(await adapter.getItem("theme")).toBe(undefined)
  })
})
