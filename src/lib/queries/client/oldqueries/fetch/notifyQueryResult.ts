import {
  type Observable,
  map,
  withLatestFrom,
  type MonoTypeOperatorFunction
} from "rxjs"
import { type QueryOptions, type QueryResult } from "../../types"

export const notifyQueryResult =
  <R>(
    options$: Observable<QueryOptions<R>>
  ): MonoTypeOperatorFunction<Partial<QueryResult<R>>> =>
  (stream$) =>
    stream$.pipe(
      withLatestFrom(options$),
      map(([result, options]) => {
        if (result.error) {
          options.onError?.(result.error)
        } else {
          options.onSuccess?.(result as R)
        }

        return result
      })
    )
