import { type Observable, defer, merge, of, throwError, timer } from "rxjs";
import {
	catchError,
	concatMap,
	first,
	mergeMap,
	retryWhen,
	tap,
} from "rxjs/operators";

export interface RetryBackoffConfig<T, TError> {
	// Initial interval. It will eventually go as high as maxInterval.
	initialInterval?: number;
	// Maximum delay between retries.
	maxInterval?: number;
	// When set to `true` every successful emission will reset the delay and the
	// error count.
	resetOnSuccess?: boolean;
	retry?: (attempt: number, error: TError) => boolean;
	retryAfterDelay?: (attempt: number, error: TError) => boolean;
	// Can be used to delay the retry (outside of backoff process)
	// for example if you want to pause retry due to connectivity issue
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	retryAfter?: () => Observable<any>;
	retryDelay?: number | ((attempt: number, error: TError) => number);
	// Conditional retry.
	// shouldRetry?: (attempt: number, error: any) => Observable<boolean>
	backoffDelay?: (iteration: number, initialInterval: number) => number;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	caughtError?: (attempt: number, error: any) => undefined | Observable<T>;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	catchError?: (attempt: number, error: any) => Observable<T>;
}

/** Calculates the actual delay which can be limited by maxInterval */
export function getDelay(backoffDelay: number, maxInterval: number) {
	return Math.min(backoffDelay, maxInterval);
}

/** Exponential backoff delay */
export function exponentialBackoffDelay(
	iteration: number,
	initialInterval: number,
) {
	return 2 ** iteration * initialInterval;
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
	const {
		retry,
		retryDelay,
		retryAfterDelay,
		retryAfter = () => of(true),
	} = config;

	const maxRetries =
		typeof retry !== "function"
			? retry === false
				? 0
				: retry === true
					? Number.POSITIVE_INFINITY
					: (retry ?? Number.POSITIVE_INFINITY)
			: Number.POSITIVE_INFINITY;

	const shouldRetry =
		typeof retry === "function"
			? // ? (attempt: number, error: TError) => of(retry(attempt, error))
				retry
			: () => true;

	const initialInterval = typeof retryDelay === "number" ? retryDelay : 100;

	const normalizedConfig = {
		shouldRetry,
		...config,
	};

	const {
		maxInterval = Number.POSITIVE_INFINITY,
		resetOnSuccess = false,
		backoffDelay = exponentialBackoffDelay,
	} = normalizedConfig;

	return <T>(source: Observable<T>) =>
		defer(() => {
			let caughtErrors = 0;

			const shouldRetryFn = (attempt: number, error: TError) =>
				attempt < maxRetries ? shouldRetry(attempt, error) : false;

			return source.pipe(
				catchError<T, Observable<T>>((error) => {
					caughtErrors++;

					if (!shouldRetryFn(caughtErrors - 1, error)) throw error;

					const caughtErrorResult$ = config.caughtError?.(caughtErrors, error);

					if (!caughtErrorResult$) throw error;

					return caughtErrorResult$.pipe(
						mergeMap((source) =>
							merge(
								of(source) as unknown as Observable<T>,
								throwError(() => error),
							),
						),
					);
				}),
				retryWhen<T>((errors) => {
					return errors.pipe(
						concatMap((error) => {
							const attempt = caughtErrors - 1;

							return retryAfter().pipe(
								first(),
								mergeMap(() =>
									shouldRetryFn(attempt, error)
										? timer(
												getDelay(
													backoffDelay(attempt, initialInterval),
													maxInterval,
												),
											).pipe(
												mergeMap((timer) => {
													if (
														retryAfterDelay &&
														!retryAfterDelay(attempt, error)
													)
														return throwError(() => error);

													return of(timer);
												}),
											)
										: throwError(() => error),
								),
							);
						}),
					);
				}),
				catchError((e) => {
					if (config.catchError) {
						return config.catchError(caughtErrors, e);
					}

					throw e;
				}),
				tap(() => {
					if (resetOnSuccess) {
						caughtErrors = 0;
					}
				}),
			);
		});
}
