import { type Observable, repeat } from "rxjs"

export const autoRefetch =
  <T>(options: { staleTime?: number } = {}) =>
  (source: Observable<T>) => {
    if (options.staleTime === Infinity) return source

    return source.pipe(
      repeat({
        delay: options.staleTime ?? 1000
      })
    )
  }
