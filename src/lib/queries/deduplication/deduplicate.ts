import { Observable, finalize, share } from "rxjs"
import { QueryStore } from "./useQueryStore"

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
        share()
      )

    if (!sourceFromStore) {
      queryStore?.set(key, finalSource)
    }

    return finalSource
  }
