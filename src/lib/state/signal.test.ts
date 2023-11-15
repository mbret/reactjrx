import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { signal } from "./signal"
import { SIGNAL_RESET } from "./constants"
import { useSignalValue } from "./useSignalValue"

describe("signal", () => {
  describe("Given a number signal with default value", () => {
    it("should reset to default value", () => {
      const state = signal({ default: 5 })

      const { result, rerender } = renderHook(() => {
        return useSignalValue(state)
      }, {})

      expect(result.current).toBe(5)

      state.setValue(6)

      rerender()

      expect(result.current).toBe(6)

      state.setValue(SIGNAL_RESET)

      rerender()

      expect(result.current).toBe(5)
    })
  })

  describe("Given a number signal with non default value", () => {
    it("should reset to undefined", () => {
      const state = signal<number | undefined>({})

      const { result, rerender } = renderHook(() => {
        return useSignalValue(state)
      }, {})

      expect(result.current).toBe(undefined)

      state.setValue(6)

      rerender()

      expect(result.current).toBe(6)

      state.setValue(SIGNAL_RESET)

      rerender()

      expect(result.current).toBe(undefined)
    })
  })
})
