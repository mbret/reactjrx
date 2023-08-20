import {
  type OperatorFunction,
  map,
  type Observable,
  withLatestFrom
} from "rxjs"
import { type QueryPipelineParams, type QueryOptions } from "../types"
import { getInitialQueryEntity } from "./initializeQueryInStore"

export const updateStoreWithNewQuery =
  <T, R>({
    queryStore,
    serializedKey,
    runner$,
    options$,
    key
  }: QueryPipelineParams<R> & {
    runner$: Observable<{
      options: QueryOptions<R>
    }>
  }): OperatorFunction<T, [T, () => void]> =>
  (stream) =>
    stream.pipe(
      withLatestFrom(options$),
      map(([value, options]) => {
        if (key.length === 0) return [value, () => {}]

        if (!queryStore.get(serializedKey)) {
          queryStore.set(serializedKey, getInitialQueryEntity({ key }))
        } else {
          queryStore.update(serializedKey, {
            queryKey: key,
            ...(options.markStale && {
              isStale: true
            })
          })
        }

        return [value, queryStore.addRunner(serializedKey, runner$)]
      })
    )
