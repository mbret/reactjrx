import { type Observable, finalize, shareReplay } from "rxjs"
import { type QueryStore } from "./types"

export const deduplicate =
  <T>(key: string, queryStore?: QueryStore) =>
  (source: Observable<T>) => {
    if (!key) return source

    const sourceFromStore: Observable<T> | undefined = queryStore?.get(key)

    const finalSource =
      sourceFromStore ??
      source.pipe(
        finalize(() => {
          queryStore?.delete(key)
        }),
        shareReplay({
          refCount: true,
          bufferSize: 1
        })
      )

    if (sourceFromStore == null) {
      queryStore?.set(key, finalSource)
    }

    return finalSource
  }
