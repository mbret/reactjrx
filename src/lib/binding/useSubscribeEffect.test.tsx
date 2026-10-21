import { act, cleanup, renderHook } from "@testing-library/react"
import {
  concat,
  config,
  defer,
  NEVER,
  type Observable,
  of,
  throwError,
} from "rxjs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  type UseSubscribeEffectOptions,
  useSubscribeEffect,
} from "./useSubscribeEffect"

let previousOnUnhandledError = config.onUnhandledError
let onUnhandledError = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  previousOnUnhandledError = config.onUnhandledError
  onUnhandledError = vi.fn()
  config.onUnhandledError = onUnhandledError
})

afterEach(() => {
  cleanup()
  // The global teardown waits on a real timer.
  vi.useRealTimers()
  config.onUnhandledError = previousOnUnhandledError
  vi.restoreAllMocks()
})

const boom = () => throwError(() => new Error("boom"))

/**
 * A source that errors synchronously on every subscription, unless
 * `behaviour` returns something else for it. Records the time between each
 * subscription and the previous one.
 */
const createSource = (
  behaviour: (subscription: number) => Observable<number> = boom,
) => {
  const delays: number[] = []
  let subscriptions = 0
  let lastSubscribedAt: number | undefined

  const source$ = defer(() => {
    const now = Date.now()

    if (lastSubscribedAt !== undefined) delays.push(now - lastSubscribedAt)

    lastSubscribedAt = now
    subscriptions++

    return behaviour(subscriptions)
  })

  return {
    source$,
    subscriptions: () => subscriptions,
    delays: () => delays,
  }
}

const renderEffect = (
  source$: Observable<number>,
  options?: UseSubscribeEffectOptions,
) =>
  renderHook(
    (props: { options?: UseSubscribeEffectOptions }) =>
      useSubscribeEffect(source$, props.options),
    { initialProps: { options } },
  )

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe("Given a source that errors", () => {
  for (const retry of [undefined, false, 0]) {
    it(`should call onError and not retry, with retry: ${retry}`, () => {
      const onError = vi.fn()
      const source = createSource()

      renderEffect(source.source$, { onError, retry })

      advance(60_000)

      expect(source.subscriptions()).toBe(1)
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onUnhandledError).toHaveBeenCalledTimes(1)
      expect(onUnhandledError.mock.calls[0]?.[0]).toBeInstanceOf(Error)
    })
  }
})

describe("Given retry: true", () => {
  it("should retry with an exponential backoff from 1 s, up to 30 s", () => {
    const source = createSource((subscription) =>
      subscription <= 7 ? boom() : NEVER,
    )

    renderEffect(source.source$, { retry: true })

    advance(200_000)

    expect(source.delays()).toEqual([
      1000, 2000, 4000, 8000, 16_000, 30_000, 30_000,
    ])
  })

  it("should never retry synchronously, even with a zero retryDelay", () => {
    // Bounded, so synchronous retries fail this test instead of hanging it.
    const source = createSource((subscription) =>
      subscription <= 5 ? boom() : NEVER,
    )

    renderEffect(source.source$, { retry: true, retryDelay: 0 })

    expect(source.subscriptions()).toBe(1)

    act(() => {
      vi.advanceTimersToNextTimer()
    })

    expect(source.subscriptions()).toBe(2)

    act(() => {
      vi.advanceTimersToNextTimer()
    })

    expect(source.subscriptions()).toBe(3)
  })

  it("should call onError for every error, including the retried ones", () => {
    const onError = vi.fn()
    const source = createSource((subscription) =>
      subscription <= 2 ? boom() : of(1),
    )

    renderEffect(source.source$, { onError, retry: true })

    advance(10_000)

    expect(source.subscriptions()).toBe(3)
    expect(onError).toHaveBeenCalledTimes(2)
    expect(onUnhandledError).not.toHaveBeenCalled()
  })
})

describe("Given retry as a number", () => {
  it("should stop after that many retries in a row, then report the error", () => {
    const onError = vi.fn()
    const source = createSource()

    renderEffect(source.source$, { onError, retry: 2, retryDelay: 10 })

    advance(60_000)

    expect(source.subscriptions()).toBe(3)
    expect(onError).toHaveBeenCalledTimes(3)
    expect(onUnhandledError).toHaveBeenCalledTimes(1)
  })

  it("should count again from 0 once the source emits", () => {
    const source = createSource((subscription) =>
      subscription === 2 ? concat(of(1), boom()) : boom(),
    )

    renderEffect(source.source$, { retry: 1, retryDelay: 10 })

    advance(60_000)

    // The 2nd subscription emits, so its error gets a fresh retry.
    expect(source.subscriptions()).toBe(3)
  })
})

describe("Given retry as a function", () => {
  it("should retry while it returns true, given the attempt and the error", () => {
    const errors = [new Error("transient"), new Error("transient")]
    const fatal = new Error("fatal")
    const source = createSource((subscription) =>
      throwError(() => errors[subscription - 1] ?? fatal),
    )
    const retry = vi.fn((_attempt: number, error: unknown) => error !== fatal)

    renderEffect(source.source$, { retry, retryDelay: 10 })

    advance(60_000)

    expect(source.subscriptions()).toBe(3)
    expect(retry.mock.calls).toEqual([
      [0, errors[0]],
      [1, errors[1]],
      [2, fatal],
    ])
  })
})

describe("Given retryDelay as a function", () => {
  it("should wait the delay it returns, given the attempt and the error", () => {
    const source = createSource((subscription) =>
      subscription <= 3 ? boom() : NEVER,
    )
    const retryDelay = vi.fn(
      (attempt: number, _error: unknown) => (attempt + 1) * 100,
    )

    renderEffect(source.source$, { retry: true, retryDelay })

    advance(60_000)

    expect(source.delays()).toEqual([100, 200, 300])
    expect(retryDelay.mock.calls.map(([attempt]) => attempt)).toEqual([0, 1, 2])
    expect(retryDelay.mock.calls[0]?.[1]).toBeInstanceOf(Error)
  })
})

describe("Given an unmount while a retry is pending", () => {
  it("should not subscribe again", () => {
    const source = createSource()

    const { unmount } = renderEffect(source.source$, { retry: true })

    unmount()
    advance(60_000)

    expect(source.subscriptions()).toBe(1)
  })
})

describe("Given options that change", () => {
  it("should not subscribe again, and use them from the next error", () => {
    const source = createSource()

    const { rerender } = renderEffect(source.source$, {
      retry: true,
      retryDelay: 1000,
    })

    rerender({ options: { retry: false } })

    expect(source.subscriptions()).toBe(1)

    advance(60_000)

    // The retry scheduled before the change still runs; its error is not
    // retried.
    expect(source.subscriptions()).toBe(2)
    expect(onUnhandledError).toHaveBeenCalledTimes(1)
  })
})
