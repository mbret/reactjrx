import { defer, throwError } from "rxjs"
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
})
