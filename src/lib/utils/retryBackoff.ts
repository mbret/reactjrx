import { defer, iif, type Observable, throwError, timer } from 'rxjs'
import { concatMap, retryWhen, tap } from 'rxjs/operators'

export interface RetryBackoffConfig {
  // Initial interval. It will eventually go as high as maxInterval.
  initialInterval: number
  // Maximum number of retry attempts.
  maxRetries?: number
  // Maximum delay between retries.
  maxInterval?: number
  // When set to `true` every successful emission will reset the delay and the
  // error count.
  resetOnSuccess?: boolean
  // Conditional retry.
  // eslint-disable-next-line no-unused-vars
  shouldRetry?: (attempt: number, error: any) => boolean
  // eslint-disable-next-line no-unused-vars
  backoffDelay?: (iteration: number, initialInterval: number) => number
}

/** Calculates the actual delay which can be limited by maxInterval */
export function getDelay (backoffDelay: number, maxInterval: number) {
  return Math.min(backoffDelay, maxInterval)
}

/** Exponential backoff delay */
export function exponentialBackoffDelay (
  iteration: number,
  initialInterval: number
) {
  return Math.pow(2, iteration) * initialInterval
}

/**
 * Returns an Observable that mirrors the source Observable with the exception
 * of an error. If the source Observable calls error, rather than propagating
 * the error call this method will resubscribe to the source Observable with
 * exponentially increasing interval and up to a maximum of count
 * resubscriptions (if provided). Retrying can be cancelled at any point if
 * shouldRetry returns false.
 */
export function retryBackoff (
  config: number | RetryBackoffConfig
  // eslint-disable-next-line no-unused-vars
): <T>(source: Observable<T>) => Observable<T> {
  const {
    initialInterval,
    maxRetries = Infinity,
    maxInterval = Infinity,
    shouldRetry = () => true,
    resetOnSuccess = false,
    backoffDelay = exponentialBackoffDelay
  } = typeof config === 'number' ? { initialInterval: config } : config
  return <T>(source: Observable<T>) =>
    defer(() => {
      let index = 0
      return source.pipe(
        retryWhen<T>((errors) => {
          return errors.pipe(
            concatMap((error) => {
              const attempt = index++
              return iif(
                () => attempt < maxRetries && shouldRetry(attempt, error),
                timer(
                  getDelay(backoffDelay(attempt, initialInterval), maxInterval)
                ),
                throwError(error)
              )
            })
          )
        }),
        tap(() => {
          if (resetOnSuccess) {
            index = 0
          }
        })
      )
    })
}
