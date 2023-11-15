import {
  type MonoTypeOperatorFunction,
  map,
  switchMap,
  distinctUntilChanged,
  type OperatorFunction,
  timer,
  tap
} from "rxjs"
import { type StoreObject, type QueryStore } from "../store/createQueryStore"
import { shallowEqual } from "../../../utils/shallowEqual"
import { mapStoreQueryToRunnerOptions } from "../store/mapStoreQueryToRunnerOptions"
import { type QueryOptions } from "../types"

const mapOptionsToOption: OperatorFunction<
  QueryOptions[],
  { lowestCacheTime?: number }
> = (stream) =>
  stream.pipe(
    map((options) =>
      options.reduce(
        (acc, value) => {
          return {
            ...acc,
            lowestCacheTime:
              value.cacheTime === undefined
                ? acc.lowestCacheTime
                : Math.min(
                    value.cacheTime ?? Infinity,
                    acc.lowestCacheTime ?? Infinity
                  )
          }
        },
        { lowestCacheTime: undefined as number | undefined }
      )
    ),
    distinctUntilChanged(shallowEqual)
  )

const onCacheUpdate: OperatorFunction<
  StoreObject,
  StoreObject["cache_fnResult"]
> = (stream) =>
  stream.pipe(
    map((item) => item.cache_fnResult),
    distinctUntilChanged(shallowEqual)
  )

export const invalidateCache =
  ({
    queryStore
  }: {
    queryStore: QueryStore
  }): MonoTypeOperatorFunction<string> =>
  (stream) =>
    stream.pipe(
      switchMap((key) => {
        const query$ = queryStore.get$(key)

        const invalidateCache$ = query$.pipe(
          onCacheUpdate,
          switchMap(() =>
            query$.pipe(
              mapStoreQueryToRunnerOptions,
              mapOptionsToOption,
              switchMap(({ lowestCacheTime = 5 * 60 * 1000 /* 5mn */ }) =>
                timer(lowestCacheTime).pipe(
                  tap(() => {
                    queryStore.update(key, { cache_fnResult: undefined })
                  })
                )
              )
            )
          )
        )

        return invalidateCache$.pipe(map(() => key))
      })
    )
