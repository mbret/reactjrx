import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useObservableState } from "./useObservableState"

afterEach(() => {
  cleanup()
})

describe("useObservableState", () => {
  it("should return the default value on first render", () => {
    const { result } = renderHook(() => useObservableState(5))

    expect(result.current[0]).toBe(5)
    expect(result.current[2].getValue()).toBe(5)
  })

  it("should re-render with the new value when setState is called", () => {
    const { result } = renderHook(() => useObservableState(0))

    act(() => {
      result.current[1](1)
    })

    expect(result.current[0]).toBe(1)
  })

  it("should re-render with the new value when setState is called with an updater", () => {
    const { result } = renderHook(() => useObservableState(1))

    act(() => {
      result.current[1]((prev) => prev + 1)
    })

    expect(result.current[0]).toBe(2)
  })

  it("should re-render when the subject is updated directly", () => {
    const { result } = renderHook(() => useObservableState(0))

    act(() => {
      result.current[2].next(10)
    })

    expect(result.current[0]).toBe(10)
  })

  it("should not re-render when setState is called with the current value", () => {
    let renderCount = 0

    const { result } = renderHook(() => {
      renderCount++

      return useObservableState(0)
    })

    const renderCountAfterMount = renderCount

    act(() => {
      result.current[1](0)
    })

    expect(result.current[0]).toBe(0)
    expect(renderCount).toBe(renderCountAfterMount)
  })
})
