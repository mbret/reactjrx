import { tap, type MonoTypeOperatorFunction } from "rxjs"
import { type QueryStore } from "../store/createQueryStore"
import { type QueryOptions } from "../types"

export const registerResultInCache =
  <T>({
    queryStore,
    serializedKey,
    options
  }: {
    queryStore: QueryStore
    serializedKey: string
    options: QueryOptions<T>
  }): MonoTypeOperatorFunction<T> =>
  (stream) =>
    stream.pipe(
      tap((result) => {
        queryStore.update(serializedKey, {
          ...(options.cacheTime !== 0 && {
            cache_fnResult: { result }
          })
        })
      })
    )
