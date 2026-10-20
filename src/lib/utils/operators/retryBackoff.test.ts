import {
  concat,
  defer,
  EMPTY,
  EmptyError,
  type Observable,
  of,
  throwError,
  timer,
} from "rxjs"
import { TestScheduler } from "rxjs/testing"
import { describe, expect, it } from "vitest"
import { type RetryBackoffConfig, retryBackoff } from "./retryBackoff"

/**
 * Subscribes to a source that always errors, piped through retryBackoff, and
 * returns the virtual time of every subscription (the first one plus each
 * retry) along with the final error.
 */
const runRetries = (config: RetryBackoffConfig<unknown, Error>) => {
  const scheduler = new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

  return scheduler.run(() => {
    const subscribedAt: number[] = []
    let finalError: unknown

    defer(() => {
      subscribedAt.push(scheduler.now())

      return throwError(() => new Error("boom"))
    })
      .pipe(retryBackoff(config))
      .subscribe({
        error: (error) => {
          finalError = error
        },
      })

    scheduler.flush()

    return { subscribedAt, finalError }
  })
}

/**
 * Like runRetries, but the source is built by `source(subscription)`, where
 * `subscription` counts from 1, and every emitted value is recorded.
 */
const runSource = (
  source: (subscription: number) => Observable<unknown>,
  config: RetryBackoffConfig<unknown, Error>,
) => {
  const scheduler = new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

  return scheduler.run(() => {
    const subscribedAt: number[] = []
    const values: unknown[] = []
    let finalError: unknown
    let errorAt: number | undefined
    let completed = false

    defer(() => {
      subscribedAt.push(scheduler.now())

      return source(subscribedAt.length)
    })
      .pipe(retryBackoff(config))
      .subscribe({
        next: (value) => values.push(value),
        error: (error) => {
          finalError = error
          errorAt = scheduler.now()
        },
        complete: () => {
          completed = true
        },
      })

    scheduler.flush()

    return { subscribedAt, values, finalError, errorAt, completed }
  })
}

const boom = () => throwError(() => new Error("boom"))

const threeRetries = (attempt: number) => attempt < 3

describe("retryBackoff", () => {
  it("backs off exponentially from a 100 ms base by default", () => {
    const { subscribedAt } = runRetries({ retry: threeRetries })

    expect(subscribedAt).toEqual([0, 100, 300, 700])
  })

  it("uses initialInterval as the base of the backoff", () => {
    const { subscribedAt } = runRetries({
      retry: threeRetries,
      initialInterval: 1000,
    })

    expect(subscribedAt).toEqual([0, 1000, 3000, 7000])
  })

  it("caps each delay at maxInterval", () => {
    const { subscribedAt } = runRetries({
      retry: (attempt) => attempt < 4,
      initialInterval: 1000,
      maxInterval: 3000,
    })

    // delays: 1000, 2000, 3000 (capped from 4000), 3000 (capped from 8000)
    expect(subscribedAt).toEqual([0, 1000, 3000, 6000, 9000])
  })

  it("passes the attempt and initialInterval to backoffDelay", () => {
    const calls: [number, number][] = []

    const { subscribedAt } = runRetries({
      retry: threeRetries,
      initialInterval: 50,
      backoffDelay: (iteration, initialInterval) => {
        calls.push([iteration, initialInterval])

        return (iteration + 1) * initialInterval
      },
    })

    expect(calls).toEqual([
      [0, 50],
      [1, 50],
      [2, 50],
    ])
    expect(subscribedAt).toEqual([0, 50, 150, 300])
  })

  it("propagates the error once retry returns false", () => {
    const { subscribedAt, finalError } = runRetries({ retry: threeRetries })

    expect(subscribedAt).toHaveLength(4)
    expect(finalError).toEqual(new Error("boom"))
  })

  it("does not accept retryDelay, use initialInterval or backoffDelay", () => {
    expect(() =>
      // @ts-expect-error retryDelay was removed: it was typed but ignored
      retryBackoff({ retryDelay: 1000 }),
    ).not.toThrow()
  })

  it("waits for retryAfter to emit before starting the backoff delay", () => {
    const { subscribedAt } = runSource(boom, {
      retry: (attempt) => attempt < 2,
      retryAfter: () => timer(500),
    })

    // 500 ms of retryAfter, then 100 ms, then 500 ms + 200 ms
    expect(subscribedAt).toEqual([0, 600, 1300])
  })

  it("errors with EmptyError when retryAfter completes without emitting", () => {
    const { subscribedAt, finalError } = runSource(boom, {
      retryAfter: () => EMPTY,
    })

    expect(subscribedAt).toEqual([0])
    expect(finalError).toBeInstanceOf(EmptyError)
  })

  it("propagates the error after the delay when retryAfterDelay returns false", () => {
    const { subscribedAt, finalError, errorAt } = runSource(boom, {
      retryAfterDelay: (attempt) => attempt < 1,
    })

    expect(subscribedAt).toEqual([0, 100])
    expect(finalError).toEqual(new Error("boom"))
    // the second delay (200 ms) still runs before the error is propagated
    expect(errorAt).toBe(300)
  })

  it("resets the attempt count on every emission when resetOnSuccess is set", () => {
    const emitThenFail = (subscription: number) =>
      subscription < 4 ? concat(of(subscription), boom()) : of(subscription)

    const withReset = runSource(emitThenFail, { resetOnSuccess: true })
    const withoutReset = runSource(emitThenFail, {})

    expect(withReset.subscribedAt).toEqual([0, 100, 200, 300])
    expect(withReset.values).toEqual([1, 2, 3, 4])
    expect(withReset.completed).toBe(true)
    expect(withoutReset.subscribedAt).toEqual([0, 100, 300, 700])
  })

  it("emits what caughtError returns before retrying", () => {
    const attempts: number[] = []

    const { subscribedAt, values, finalError } = runSource(boom, {
      retry: (attempt) => attempt < 2,
      caughtError: (attempt) => {
        attempts.push(attempt)

        return of(`fallback ${attempt}`)
      },
    })

    expect(attempts).toEqual([1, 2])
    expect(values).toEqual(["fallback 1", "fallback 2"])
    expect(subscribedAt).toEqual([0, 100, 300])
    expect(finalError).toEqual(new Error("boom"))
  })

  it("replaces the final error with what catchError returns", () => {
    const calls: [number, unknown][] = []

    const { values, finalError, completed } = runSource(boom, {
      retry: (attempt) => attempt < 2,
      catchError: (attempt, error) => {
        calls.push([attempt, error])

        return of("recovered")
      },
    })

    expect(calls).toEqual([[3, new Error("boom")]])
    expect(values).toEqual(["recovered"])
    expect(finalError).toBeUndefined()
    expect(completed).toBe(true)
  })
})
