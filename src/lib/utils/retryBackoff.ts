import { defer, iif, type Observable, throwError, timer, merge } from "rxjs"
import { catchError, concatMap, retryWhen, tap } from "rxjs/operators"

export interface RetryBackoffConfig<T> {
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
  caughtError?: (attempt: number, error: any) => void | Observable<T>
  catchError?: (attempt: number, error: any) => Observable<T>
}

/** Calculates the actual delay which can be limited by maxInterval */
export function getDelay(backoffDelay: number, maxInterval: number) {
  return Math.min(backoffDelay, maxInterval)
}

/** Exponential backoff delay */
export function exponentialBackoffDelay(
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
export function retryBackoff<T>(config: RetryBackoffConfig<T>) {
  const {
    initialInterval,
    maxRetries = Infinity,
    maxInterval = Infinity,
    shouldRetry = () => true,
    resetOnSuccess = false,
    backoffDelay = exponentialBackoffDelay
  } = config

  return <T>(source: Observable<T>) =>
    defer(() => {
      let caughtErrors = 0

      const shouldRetryFn = (attempt: number, error: unknown) =>
        attempt < maxRetries && shouldRetry(attempt, error)

      return source.pipe(
        catchError((error) => {
          caughtErrors++

          if (!shouldRetryFn(caughtErrors - 1, error)) throw error

          const caughtErrorResult = config.caughtError(caughtErrors, error)

          if (!caughtErrorResult) throw error

          return merge(
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            caughtErrorResult,
            throwError(() => error)
          )
        }),
        retryWhen<T>((errors) => {
          return errors.pipe(
            concatMap((error) => {
              const attempt = caughtErrors - 1

              return iif(
                () => shouldRetryFn(attempt, error),
                timer(
                  getDelay(backoffDelay(attempt, initialInterval), maxInterval)
                ),
                throwError(() => error)
              )
            })
          )
        }),
        catchError((e) => {
          if (config.catchError) {
            return config.catchError(caughtErrors, e)
          }

          throw e
        }),
        tap(() => {
          if (resetOnSuccess) {
            caughtErrors = 0
          }
        })
      )
    })
}
