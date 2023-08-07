import { type Observable, repeat, timer, of, switchMap, EMPTY } from "rxjs"

const DEFAULT_STALE = 9999

export const autoRefetch =
  <T>(options$: Observable<{ staleTime?: number }> = of({})) =>
  (source: Observable<T>) => {
    return source.pipe(
      repeat({
        delay: () =>
          options$.pipe(
            switchMap((options) =>
              options.staleTime === Infinity
                ? EMPTY
                : timer(options.staleTime ?? DEFAULT_STALE)
            )
          )
      })
    )
  }
