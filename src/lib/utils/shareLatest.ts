import { MonoTypeOperatorFunction, ReplaySubject, share } from "rxjs";

/**
 * Share the latest value to every new observers but clean up
 * otherwise.
 *
 * We cannot use shareReplay with react since it would never clean
 * selectors and create memory leak. shareLatest ensure when the selector
 * is not mounted anywhere we reset it
 */
export const shareLatest = <T>(): MonoTypeOperatorFunction<T> =>
  share<T>({
    connector: () => new ReplaySubject<T>(1),
    resetOnError: true,
    resetOnComplete: true,
    resetOnRefCountZero: true,
  });
