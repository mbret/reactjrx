import { type OperatorFunction, map, type Observable } from "rxjs"
import { type QueryStore } from "./createQueryStore"
import { type QueryOptions } from "../types"
import { type QueryKey } from "../keys/types"
import { getInitialQueryEntity } from "./initializeQueryInStore"

export const updateStoreWithQuery =
  <T extends { options: QueryOptions<R> }, R>({
    queryStore,
    serializedKey,
    runner$,
    key
  }: {
    queryStore: QueryStore
    serializedKey: string
    key: QueryKey
    runner$: Observable<{
      options: QueryOptions<R>
    }>
  }): OperatorFunction<T, [T, () => void]> =>
  (stream) =>
    stream.pipe(
      map((value) => {
        if (key.length === 0) return [value, () => {}]

        if (!queryStore.get(serializedKey)) {
          queryStore.set(serializedKey, getInitialQueryEntity({ key }))
        } else {
          queryStore.update(serializedKey, {
            queryKey: key,
            ...(value.options.markStale && {
              isStale: true
            })
          })
        }

        return [value, queryStore.addRunner(serializedKey, runner$)]
      })
    )
