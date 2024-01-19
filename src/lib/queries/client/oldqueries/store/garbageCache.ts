import {
  type MonoTypeOperatorFunction,
  map,
  switchMap,
  tap,
  filter,
  pairwise
} from "rxjs"
import { type QueryStore } from "./createQueryStore"

export const garbageCache =
  ({
    queryStore
  }: {
    queryStore: QueryStore
  }): MonoTypeOperatorFunction<string> =>
  (stream) =>
    stream.pipe(
      switchMap((key) => {
        const query$ = queryStore.get$(key)

        return query$.pipe(
          filter((entry) => !entry.cache_fnResult),
          map((entry) => entry.runners.length > 0),
          pairwise(),
          filter(([hadRunners, hasRunners]) => hadRunners && !hasRunners),
          tap(() => {
            queryStore.delete(key)
          }),
          map(() => key)
        )
      })
    )
