import { act, renderHook } from "@testing-library/react"
import { StrictMode } from "react"
import { BehaviorSubject, config, defer, throwError } from "rxjs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { waitForTimeout } from "../../../tests/utils"
import { useObserve } from "./useObserve"

let previousOnUnhandledError = config.onUnhandledError
let onUnhandledError = vi.fn()

beforeEach(() => {
  previousOnUnhandledError = config.onUnhandledError
  onUnhandledError = vi.fn()
  config.onUnhandledError = onUnhandledError
})

afterEach(() => {
  config.onUnhandledError = previousOnUnhandledError
})

const error = new Error("boom")

const modes = [
  { name: "", wrapper: undefined },
  { name: " under StrictMode", wrapper: StrictMode },
]

describe("Given a source that errors on subscription", () => {
  const createSource = () => {
    let subscriptions = 0

    const source$ = defer(() => {
      subscriptions++

      return throwError(() => error)
    })

    return { source$, subscriptions: () => subscriptions }
  }

  for (const { name, wrapper } of modes) {
    it(`should return the error${name}`, async () => {
      const { source$ } = createSource()

      const { result } = renderHook(() => useObserve(source$), { wrapper })

      await waitForTimeout(10)

      expect(result.current).toEqual({
        data: undefined,
        status: "error",
        observableState: "error",
        error,
      })
    })

    it(`should not subscribe to the source again${name}`, async () => {
      const source = createSource()

      renderHook(() => useObserve(source.source$), { wrapper })

      await waitForTimeout(10)

      expect(source.subscriptions()).toBe(1)
    })

    it(`should not report the error as unhandled${name}`, async () => {
      const { source$ } = createSource()

      renderHook(() => useObserve(source$), { wrapper })

      await waitForTimeout(10)

      expect(onUnhandledError).not.toHaveBeenCalled()
    })
  }
})

describe("Given a source that errors after emitting", () => {
  for (const { name, wrapper } of modes) {
    it(`should keep the last value, return the error and not report it${name}`, async () => {
      const source$ = new BehaviorSubject(1)

      const { result } = renderHook(() => useObserve(source$), { wrapper })

      act(() => {
        source$.error(error)
      })

      await waitForTimeout(10)

      expect(result.current).toEqual({
        data: 1,
        status: "error",
        observableState: "error",
        error,
      })
      expect(onUnhandledError).not.toHaveBeenCalled()
    })
  }
})
