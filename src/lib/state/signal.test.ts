import { renderHook } from "@testing-library/react"
import { act } from "react"
import { describe, expect, expectTypeOf, it } from "vitest"
import { SIGNAL_RESET } from "./constants"
import { useSignalValue } from "./react/useSignalValue"
import { type Signal, type SignalValue, signal } from "./Signal"

describe("signal", () => {
  it("should have correct types for various signal configurations", () => {
    // Test 1: signal with no arguments
    const s0 = signal({})
    expectTypeOf<Signal<undefined, undefined>>(s0)
    expectTypeOf<undefined>(s0.value)

    // Test 2: signal with key only
    const s1 = signal({ key: "test1" })
    expectTypeOf<Signal<undefined, "test1">>(s1)
    expectTypeOf<undefined>(s1.value)

    // Test 3: signal with default value only
    const s2 = signal({ default: 42 })
    expectTypeOf<Signal<number, undefined>>(s2)
    expectTypeOf<number>(s2.value)

    // Test 4: signal with key and default
    const s3 = signal({ key: "test3", default: "hello" })
    expectTypeOf<Signal<string, "test3">>(s3)
    expectTypeOf<string>(s3.value)

    // Test 5: typed signal with no default
    const s4 = signal<string>({ key: "test4" })
    expectTypeOf<Signal<string | undefined, string>>(s4)
    expectTypeOf<string | undefined>(s4.value)

    // Test 6: typed signal with default
    const s5 = signal<number>({ default: 100 })
    expectTypeOf<Signal<number, undefined>>(s5)
    expectTypeOf<number>(s5.value)

    // Test 7: typed signal with key and default
    const s6 = signal<boolean>({ key: "test6", default: false })
    expectTypeOf<Signal<boolean, string>>(s6)
    expectTypeOf<boolean>(s6.value)

    // Test 8: using SignalValue to extract value type
    type S7Type = SignalValue<typeof s3>
    expectTypeOf<string>({} as S7Type)
  })

  describe("Given a number signal with default value", () => {
    it("should reset to default value", () => {
      const state = signal({ default: 5 })

      const { result, rerender } = renderHook(() => {
        return useSignalValue(state)
      }, {})

      expect(result.current).toBe(5)

      act(() => {
        state.setValue(6)
      })

      rerender()

      expect(result.current).toBe(6)

      act(() => {
        state.setValue(SIGNAL_RESET)
      })

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

      act(() => {
        state.setValue(6)
      })

      rerender()

      expect(result.current).toBe(6)

      state.setValue(SIGNAL_RESET)

      rerender()

      expect(result.current).toBe(undefined)
    })
  })
})
