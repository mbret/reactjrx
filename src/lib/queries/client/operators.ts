import {
  type Observable,
  map,
  withLatestFrom,
  startWith,
  pairwise,
  distinctUntilChanged,
} from "rxjs"
import { type QuerxOptions } from "../types"
import { shallowEqual } from "../../utils/shallowEqual"
import { type QueryResult } from "./types"

export const notifyQueryResult =
  <T>(options$: Observable<QuerxOptions<T>>) =>
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
    startWith({ isLoading: false, data: undefined, error: undefined }),
    pairwise(),
    map(([previous, current]) => ({
      isLoading: false,
      data: undefined,
      error: undefined,
      ...previous,
      ...current
    })),
    distinctUntilChanged(shallowEqual)
  )
