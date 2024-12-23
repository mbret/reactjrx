import {
  type MonoTypeOperatorFunction,
  type Observable,
  Subject,
  delay,
  filter,
  first,
  mergeMap,
  takeUntil,
  tap
} from "rxjs"

export const completeFnIfNotMoreObservers =
  <T>(observers$: Observable<number>): MonoTypeOperatorFunction<T> =>
  (source) => {
    const hasDataSubject = new Subject<void>()
    const hasDataAndNoObservers$ = hasDataSubject.pipe(
      first(),
      /**
       * Since we set hasDataSubject synchronously, we need to wait
       * for the next tick to make sure observable chain received this data at least
       */
      delay(1),
      mergeMap(() => observers$.pipe(filter((value) => value === 0)))
    )

    return source.pipe(
      tap(() => {
        hasDataSubject.next()
      }),
      takeUntil(hasDataAndNoObservers$)
    )
  }
