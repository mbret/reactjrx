import { Observable, repeat } from "rxjs"

export const autoRefetch =
  <T>(options: { staleTime?: number } = {}) =>
  (source: Observable<T>) => {
    return source.pipe(
      repeat({
        delay: options.staleTime ?? 1000
      })
    )
  }
