import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDebounced } from "./useDebounced"

describe("useDebounced", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should run func once, with the last argument of a burst of calls", () => {
    const func = vi.fn()
    const { result } = renderHook(() => useDebounced(func, 100))

    result.current("first")
    act(() => {
      vi.advanceTimersByTime(50)
    })
    result.current("second")
    act(() => {
      vi.advanceTimersByTime(99)
    })

    expect(func).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(func).toHaveBeenCalledTimes(1)
    expect(func).toHaveBeenCalledWith("second")
  })

  it("should run the latest func when the delay ends", () => {
    const first = vi.fn()
    const latest = vi.fn()
    const { result, rerender } = renderHook(
      ({ func }) => useDebounced(func, 100),
      { initialProps: { func: first } },
    )

    result.current("value")
    rerender({ func: latest })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith("value")
  })

  it("should run a pending call after the component unmounts", () => {
    const func = vi.fn()
    const { result, unmount } = renderHook(() => useDebounced(func, 100))

    result.current("value")
    unmount()
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(func).toHaveBeenCalledWith("value")
  })

  it("should cancel a pending call on unmount with cancelOnUnmount: true", () => {
    const func = vi.fn()
    const { result, unmount } = renderHook(() =>
      useDebounced(func, 100, { cancelOnUnmount: true }),
    )

    result.current("value")
    unmount()
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(func).not.toHaveBeenCalled()
  })
})
