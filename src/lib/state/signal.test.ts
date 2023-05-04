import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { signal } from "./signal"
import { SIGNAL_RESET } from "./constants"

describe("signal", () => {
  describe("Given a number signal with default value", () => {
    it("should reset to default value", () => {
      const [useValue, setValue] = signal({ default: 5 })

      const { result, rerender } = renderHook(() => {
        return useValue()
      }, {})

      expect(result.current).toBe(5)

      setValue(6)

      rerender()

      expect(result.current).toBe(6)

      setValue(SIGNAL_RESET)

      rerender()

      expect(result.current).toBe(5)
    })
  })

  describe("Given a number signal with non default value", () => {
    it("should reset to undefined", () => {
      const [useValue, setValue] = signal<number | undefined>({})

      const { result, rerender } = renderHook(() => {
        return useValue()
      }, {})

      expect(result.current).toBe(undefined)

      setValue(6)

      rerender()

      expect(result.current).toBe(6)

      setValue(SIGNAL_RESET)

      rerender()

      expect(result.current).toBe(undefined)
    })
  })
})
