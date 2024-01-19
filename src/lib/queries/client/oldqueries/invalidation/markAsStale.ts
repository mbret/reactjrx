import {
  switchMap,
  type MonoTypeOperatorFunction,
  filter,
  map,
  tap,
  type OperatorFunction,
  timer,
  distinctUntilChanged
} from "rxjs"
import { type QueryEvent, type QueryStore } from "../store/createQueryStore"
import { logger } from "./logger"
import { mapStoreQueryToRunnerOptions } from "../store/mapStoreQueryToRunnerOptions"
import { type QueryOptions } from "../../types"
import { shallowEqual } from "../../../../utils/shallowEqual"

const mapOptionsToOption: OperatorFunction<
  QueryOptions[],
  { lowestStaleTime?: number }
> = (stream) =>
  stream.pipe(
    map((options) =>
      options.reduce(
        (acc, value) => {
          return {
            ...acc,
            lowestStaleTime:
              value.staleTime === undefined
                ? acc.lowestStaleTime
                : Math.min(
                    value.staleTime ?? Infinity,
                    acc.lowestStaleTime ?? Infinity
                  )
          }
        },
        { lowestStaleTime: undefined as number | undefined }
      )
    ),
    distinctUntilChanged(shallowEqual)
  )

const onlyFetchEventDone =
  (key: string): MonoTypeOperatorFunction<QueryEvent> =>
  (stream) =>
    stream.pipe(
      filter(
        (event) =>
          event.key === key &&
          (event.type === "fetchError" || event.type === "fetchSuccess")
      )
    )

/**
 * @important global query listener
 */
export const markAsStale =
  ({
    queryStore
  }: {
    queryStore: QueryStore
  }): MonoTypeOperatorFunction<string> =>
  (stream) =>
    stream.pipe(
      switchMap((key) => {
        const query$ = queryStore.get$(key)

        return queryStore.queryEvent$.pipe(
          onlyFetchEventDone(key),
          switchMap(() =>
            query$.pipe(
              mapStoreQueryToRunnerOptions,
              mapOptionsToOption,
              tap(({ lowestStaleTime = 0 }) => {
                if (lowestStaleTime === 0) {
                  logger.log(key, "marked as stale!", {
                    staleTime: lowestStaleTime
                  })
                  queryStore.update(key, { isStale: true })
                } else if (queryStore.get(key)?.isStale) {
                  logger.log(key, "marked non stale", {
                    staleTime: lowestStaleTime
                  })
                  queryStore.update(key, { isStale: false })
                }
              }),
              filter(
                ({ lowestStaleTime }) =>
                  lowestStaleTime !== Infinity && lowestStaleTime !== 0
              ),
              switchMap(({ lowestStaleTime = 0 }) => timer(lowestStaleTime)),
              tap(() => {
                if (!queryStore.get(key)?.isStale) {
                  logger.log(key, "marked as stale!")
                  queryStore.update(key, { isStale: true })
                }
              })
            )
          ),
          map(() => key)
        )
      })
    )
