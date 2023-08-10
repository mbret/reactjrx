import {
  type Observable,
  map,
  withLatestFrom,
  distinctUntilChanged,
  scan
} from "rxjs"
import { shallowEqual } from "../../utils/shallowEqual"
import { type QueryOptions, type QueryResult } from "./types"
import { retryBackoff } from "../../utils/retryBackoff"

export const retryFromOptions = <T>(options: QueryOptions<T>) =>
  retryBackoff({
    initialInterval: 100,
    ...(typeof options.retry === "function"
      ? {
          shouldRetry: options.retry
        }
      : {
          maxRetries: options.retry === false ? 0 : options.retry ?? 3
        })
  })

export const notifyQueryResult =
  <T>(options$: Observable<QueryOptions<T>>) =>
  (stream$: Observable<Partial<QueryResult<T>>>) =>
    stream$.pipe(
      withLatestFrom(options$),
      map(([result, options]) => {
        if (result.error) {
          options.onError?.(result.error)
        } else {
          options.onSuccess?.(result as T)
        }

        return result
      })
    )

export const mergeResults = <T>(
  stream$: Observable<Partial<QueryResult<T>>>
): Observable<QueryResult<T>> =>
  stream$.pipe(
    scan(
      (acc: QueryResult<T>, current) => {
        return {
          ...acc,
          ...current
        }
      },
      {
        data: undefined,
        error: undefined,
        fetchStatus: "idle",
        status: "loading"
      }
    ),
    distinctUntilChanged(shallowEqual)
  )
