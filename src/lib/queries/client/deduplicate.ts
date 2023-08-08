import { type Observable, shareReplay, defer, tap, finalize } from "rxjs"
import { type QueryStore } from "./types"
import { serializeKey } from "./keys/serializeKey"

export const deduplicate =
  <T>(key: string, queryStore?: QueryStore) =>
  (source: Observable<T>) => {
    if (key === serializeKey([])) return source

    return defer(() => {
      const sourceFromStore: Observable<T> | undefined = queryStore?.get(key)

      const deleteFromStore = () => {
        queryStore?.delete(key)
      }

      const finalSource =
        sourceFromStore ??
        source.pipe(
          /**
           * Ideally we would want to remove the query from the store only on finalize,
           * which means whenever the query complete or error. Unfortunately finalize is
           * triggered after a new stream arrive which create a concurrency issue.
           * tap is triggered correctly synchronously and before a new query arrive.
           */
          tap({
            error: deleteFromStore,
            complete: deleteFromStore
          }),
          /**
           * Because tap is not called on unsubscription we still need to handle the case.
           */
          finalize(deleteFromStore),
          shareReplay({
            refCount: true,
            bufferSize: 1
          })
        )

      if (!sourceFromStore) {
        queryStore?.set(key, finalSource)
      }

      return finalSource
    })
  }
