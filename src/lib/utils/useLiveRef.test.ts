import { act, renderHook } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { useLiveRef } from "./useLiveRef"

describe("useLiveRef", () => {
  test("should return a ref object with an initial value", () => {
    const initialValue = "test"
    const { result } = renderHook(({ value }) => useLiveRef(value), {
      initialProps: { value: initialValue }
    })

    return expect(result.current.current).toBe(initialValue)
  })

  test("should update the ref object after layout", () => {
    const initialValue = "test"
    const updatedValue = "updated"
    const { result, rerender } = renderHook(({ value }) => useLiveRef(value), {
      initialProps: { value: initialValue }
    })

    expect(result.current.current).toBe(initialValue)

    rerender({ value: updatedValue })

    act(() => {})

    expect(result.current.current).toBe(updatedValue)
  })
})
