import { act, cleanup, renderHook } from "@testing-library/react"
import { config, defer, of, throwError } from "rxjs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { waitForTimeout } from "../../tests/utils"
import { useSubscribeEffect } from "./useSubscribeEffect"

let previousOnUnhandledError = config.onUnhandledError

beforeEach(() => {
  previousOnUnhandledError = config.onUnhandledError
  config.onUnhandledError = () => {}
})

afterEach(() => {
  config.onUnhandledError = previousOnUnhandledError
  cleanup()
  vi.restoreAllMocks()
})

describe("useSubscribeEffect", () => {
  it("should call onError when source errors", async () => {
    const onError = vi.fn()
    let subscribeCount = 0

    const source$ = defer(() => {
      subscribeCount += 1
      return subscribeCount === 1 ? throwError(() => new Error("boom")) : of(1)
    })

    renderHook(() => {
      useSubscribeEffect(source$, { onError, retryOnError: true })
    })

    await act(async () => {
      await waitForTimeout(0)
    })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(subscribeCount).toBe(2)
  })

  it("should not retry when retryOnError is false", async () => {
    const onError = vi.fn()
    const onUnhandledError = vi.fn()
    let subscribeCount = 0
    config.onUnhandledError = onUnhandledError

    const source$ = defer(() => {
      subscribeCount += 1
      return throwError(() => new Error("boom"))
    })

    renderHook(() => {
      useSubscribeEffect(source$, { onError, retryOnError: false })
    })

    await act(async () => {
      await waitForTimeout(0)
    })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onUnhandledError).toHaveBeenCalledTimes(1)
    expect(onUnhandledError.mock.calls[0]?.[0]).toBeInstanceOf(Error)
    expect(subscribeCount).toBe(1)
  })
})
