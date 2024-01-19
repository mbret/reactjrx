import { type Observable, shareReplay, defer, tap, finalize } from "rxjs"
import { serializeKey } from "../../keys/serializeKey"
import { type QueryStore } from "../store/createQueryStore"

export const deduplicate =
  <T>(key: string, queryStore: QueryStore) =>
  (source: Observable<T>) => {
    if (key === serializeKey([])) return source

    return defer(() => {
      const sourceFromStore: Observable<T> | undefined =
        queryStore.get<T>(key)?.deduplication_fn

      if (sourceFromStore) return sourceFromStore

      // eslint-disable-next-line prefer-const
      let sourceToDeduplicate: Observable<T> | undefined

      const deleteFromStore = () => {
        /**
         * @important
         * We only remove our original source since it's possible another query
         * already replaced it due to a refetch for example. We don't want to remove
         * a valid deduplication
         */
        if (queryStore.get(key)?.deduplication_fn === sourceToDeduplicate) {
          queryStore.update(key, {
            deduplication_fn: undefined
          })
        }
      }

      sourceToDeduplicate = source.pipe(
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

      queryStore.update(key, {
        deduplication_fn: sourceToDeduplicate
      })

      return sourceToDeduplicate
    })
  }
