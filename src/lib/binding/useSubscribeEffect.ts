import { useCallback } from "react"
import { retry, tap, throwError, timer } from "rxjs"
import { makeObservable } from "../utils/makeObservable"
import {
  exponentialBackoffDelay,
  getDelay,
} from "../utils/operators/retryBackoff"
import { useLiveRef } from "../utils/react/useLiveRef"
import type { SubscribeSource } from "./useSubscribe/types"
import { useSubscribe } from "./useSubscribe/useSubscribe"

export interface UseSubscribeEffectOptions {
  /**
   * Called on every error of the source, including the ones that are
   * retried.
   */
  onError?: (error: unknown) => void
  /**
   * Whether to subscribe to the source again after an error:
   * - `false` (default): the error ends the subscription;
   * - `true`: retry without limit;
   * - a number: retry at most that many times in a row;
   * - a function: given the attempt (0 for the first retry) and the error,
   *   returns whether to retry.
   *
   * The attempt count goes back to 0 once the source emits again.
   */
  retry?: boolean | number | ((attempt: number, error: unknown) => boolean)
  /**
   * Time to wait before each retry, in milliseconds, or a function of the
   * attempt and the error. Retries always wait for a timer, so they never
   * run synchronously, even with `0`. Defaults to an exponential backoff:
   * 1 s, 2 s, 4 s… up to 30 s.
   */
  retryDelay?: number | ((attempt: number, error: unknown) => number)
}

const defaultRetryDelay = (attempt: number) =>
  getDelay(exponentialBackoffDelay(attempt, 1000), 30_000)

const shouldRetry = (
  retryOption: UseSubscribeEffectOptions["retry"],
  attempt: number,
  error: unknown,
) => {
  if (typeof retryOption === "function") return retryOption(attempt, error)

  if (typeof retryOption === "number") return attempt < retryOption

  return retryOption === true
}

/**
 * Subscribes to `source` while the component is mounted. Options are read
 * at each error, so changing them never subscribes again.
 */
export function useSubscribeEffect<T>(
  source: SubscribeSource<T>,
  options?: UseSubscribeEffectOptions,
) {
  const optionsRef = useLiveRef(options)

  const enhancerMakeObservable = useCallback(() => {
    const source$ = makeObservable(source)()

    return source$.pipe(
      tap({
        error: (error) => {
          optionsRef.current?.onError?.(error)
        },
      }),
      retry({
        resetOnSuccess: true,
        delay: (error, retryCount) => {
          const attempt = retryCount - 1
          const { retry: retryOption, retryDelay = defaultRetryDelay } =
            optionsRef.current ?? {}

          if (!shouldRetry(retryOption, attempt, error)) {
            return throwError(() => error)
          }

          return timer(
            typeof retryDelay === "function"
              ? retryDelay(attempt, error)
              : retryDelay,
          )
        },
      }),
    )
  }, [source, optionsRef])

  useSubscribe(enhancerMakeObservable)
}
