import { defer, type Observable, throwError, timer, merge, of } from "rxjs"
import {
  catchError,
  concatMap,
  first,
  mergeMap,
  retryWhen,
  switchMap,
  tap
} from "rxjs/operators"

export interface RetryBackoffConfig<T, TError> {
  // Initial interval. It will eventually go as high as maxInterval.
  initialInterval?: number
  // Maximum delay between retries.
  maxInterval?: number
  // When set to `true` every successful emission will reset the delay and the
  // error count.
  resetOnSuccess?: boolean
  retry?: (attempt: number, error: TError) => Observable<boolean>
  retryDelay?: number | ((failureCount: number, error: TError) => number)
  // Conditional retry.
  // shouldRetry?: (attempt: number, error: any) => Observable<boolean>
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
 * re-subscriptions (if provided). Retrying can be cancelled at any point if
 * shouldRetry returns false.
 */
export function retryBackoff<T, TError>(config: RetryBackoffConfig<T, TError>) {
  const { retry, retryDelay } = config

  const maxRetries =
    typeof retry !== "function"
      ? retry === false
        ? 0
        : retry === true
          ? Infinity
          : retry ?? Infinity
      : Infinity

  const shouldRetry =
    typeof retry === "function"
      ? // ? (attempt: number, error: TError) => of(retry(attempt, error))
        retry
      : () => of(true)

  const initialInterval = typeof retryDelay === "number" ? retryDelay : 100

  const normalizedConfig = {
    shouldRetry,
    ...config
  }

  const {
    maxInterval = Infinity,
    resetOnSuccess = false,
    backoffDelay = exponentialBackoffDelay
  } = normalizedConfig

  return <T>(source: Observable<T>) =>
    defer(() => {
      let caughtErrors = 0

      const shouldRetryFn = (attempt: number, error: TError) =>
        attempt < maxRetries ? shouldRetry(attempt, error) : of(false)

      return source.pipe(
        catchError<T, Observable<T>>((error) => {
          caughtErrors++

          return shouldRetryFn(caughtErrors - 1, error).pipe(
            switchMap((shouldRetry) => {
              if (!shouldRetry) throw error

              const caughtErrorResult$ = config.caughtError?.(
                caughtErrors,
                error
              )

              if (!caughtErrorResult$) throw error

              return caughtErrorResult$.pipe(
                mergeMap((source) =>
                  merge(
                    of(source) as unknown as Observable<T>,
                    throwError(() => error)
                  )
                )
              )
            })
          )
        }),
        retryWhen<T>((errors) => {
          return errors.pipe(
            concatMap((error) => {
              const attempt = caughtErrors - 1

              return defer(() => {
                const shouldRetry$ = shouldRetryFn(attempt, error)

                return shouldRetry$.pipe(
                  first(),
                  mergeMap((shouldRetry) =>
                    shouldRetry
                      ? timer(
                          getDelay(
                            backoffDelay(attempt, initialInterval),
                            maxInterval
                          )
                        )
                      : throwError(() => error)
                  )
                )
              })
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
