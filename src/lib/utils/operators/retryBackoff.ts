import { defer, merge, type Observable, of, throwError, timer } from "rxjs"
import { catchError, first, mergeMap, retry, tap } from "rxjs/operators"

export interface RetryBackoffConfig<T, TError> {
  // Base delay of the backoff (default 100 ms), passed to backoffDelay. With
  // the default exponential backoff, retry n waits 2^n * initialInterval, up
  // to maxInterval.
  initialInterval?: number
  // Maximum delay between retries.
  maxInterval?: number
  // When set to `true` every successful emission will reset the delay and the
  // error count.
  resetOnSuccess?: boolean
  retry?: (attempt: number, error: TError) => boolean
  retryAfterDelay?: (attempt: number, error: TError) => boolean
  // Can be used to delay the retry (outside of backoff process)
  // for example if you want to pause retry due to connectivity issue
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  retryAfter?: () => Observable<any>
  // Computes the delay before retry `iteration` (0-based) from
  // initialInterval. Defaults to exponentialBackoffDelay.
  backoffDelay?: (iteration: number, initialInterval: number) => number
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  caughtError?: (attempt: number, error: any) => undefined | Observable<T>
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  catchError?: (attempt: number, error: any) => Observable<T>
}

/** Calculates the actual delay which can be limited by maxInterval */
export function getDelay(backoffDelay: number, maxInterval: number) {
  return Math.min(backoffDelay, maxInterval)
}

/** Exponential backoff delay */
export function exponentialBackoffDelay(
  iteration: number,
  initialInterval: number,
) {
  return 2 ** iteration * initialInterval
}

/**
 * Returns an Observable that mirrors the source Observable with the exception
 * of an error. If the source Observable calls error, rather than propagating
 * the error this operator resubscribes to the source Observable after a
 * backoff delay (exponentially increasing by default). Retrying stops as soon
 * as `retry` returns false.
 */
export function retryBackoff<T, TError>(config: RetryBackoffConfig<T, TError>) {
  const {
    retry: shouldRetry = () => true,
    retryAfterDelay,
    retryAfter = () => of(true),
    initialInterval = 100,
    maxInterval = Number.POSITIVE_INFINITY,
    resetOnSuccess = false,
    backoffDelay = exponentialBackoffDelay,
  } = config

  return <T>(source: Observable<T>) =>
    defer(() => {
      let caughtErrors = 0

      return source.pipe(
        catchError<T, Observable<T>>((error) => {
          caughtErrors++

          if (!shouldRetry(caughtErrors - 1, error)) throw error

          const caughtErrorResult$ = config.caughtError?.(caughtErrors, error)

          if (!caughtErrorResult$) throw error

          return caughtErrorResult$.pipe(
            mergeMap((source) =>
              merge(
                of(source) as unknown as Observable<T>,
                throwError(() => error),
              ),
            ),
          )
        }),
        retry({
          delay: (error) => {
            const attempt = caughtErrors - 1

            return retryAfter().pipe(
              first(),
              mergeMap(() =>
                shouldRetry(attempt, error)
                  ? timer(
                      getDelay(
                        backoffDelay(attempt, initialInterval),
                        maxInterval,
                      ),
                    ).pipe(
                      mergeMap((timer) => {
                        if (retryAfterDelay && !retryAfterDelay(attempt, error))
                          return throwError(() => error)

                        return of(timer)
                      }),
                    )
                  : throwError(() => error),
              ),
            )
          },
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
        }),
      )
    })
}
