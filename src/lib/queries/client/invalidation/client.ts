import {
  EMPTY,
  type MonoTypeOperatorFunction,
  type Observable,
  distinctUntilChanged,
  filter,
  map,
  merge,
  mergeMap,
  pairwise,
  startWith,
  switchMap,
  tap,
  timer
} from "rxjs"
import { type createQueryStore } from "../store/createQueryStore"
import { compareKeys } from "../keys/compareKeys"
import { type QueryKey } from "../keys/types"
import { difference } from "../../../utils/difference"
import { shallowEqual } from "../../../utils/shallowEqual"
import { Logger } from "../../../logger"
import {
  type QueryTrigger,
  type QueryOptions,
  type QueryResult
} from "../types"

const logger = Logger.namespace("invalidation")

type Result<T> = Partial<QueryResult<T>>

export const createInvalidationClient = ({
  queryStore
}: {
  queryStore: ReturnType<typeof createQueryStore>
}) => {
  const invalidateQueries = ({
    queryKey,
    exact = false,
    predicate
  }: {
    queryKey?: QueryKey
    exact?: boolean
    predicate?: Parameters<typeof queryStore.updateMany>[1]
  } = {}) => {
    if (queryKey) {
      queryStore.updateMany({ isStale: true }, (storeObject) =>
        compareKeys(queryKey, storeObject.queryKey, { exact })
      )
    } else if (predicate) {
      queryStore.updateMany({ isStale: true }, predicate)
    } else {
      queryStore.updateMany({ isStale: true })
    }
  }

  const staleUpdateSub = queryStore.store$
    .pipe(
      map((store) => [...store.keys()]),
      startWith([]),
      pairwise(),
      mergeMap(([previousKeys, currentKeys]) => {
        const newKeys = difference(currentKeys, previousKeys)

        const objects$ = merge(
          ...newKeys.map((key) => {
            const query$ = queryStore.get$(key) ?? EMPTY

            const newFetch$ = query$.pipe(
              map(({ lastFetchedAt, lowestStaleTime = 0 }) => ({
                lowestStaleTime,
                lastFetchedAt
              })),
              filter(({ lastFetchedAt }) => lastFetchedAt !== undefined),
              distinctUntilChanged(shallowEqual)
            )

            return newFetch$.pipe(
              tap(({ lowestStaleTime }) => {
                if (lowestStaleTime < 1) {
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
              filter(({ lowestStaleTime }) => lowestStaleTime !== Infinity),
              switchMap(({ lowestStaleTime }) => timer(lowestStaleTime)),
              tap(() => {
                if (!queryStore.get(key)?.isStale) {
                  logger.log(key, "marked as stale!")
                  queryStore.update(key, { isStale: true })
                }
              })
            )
          })
        )

        return objects$
      })
    )
    .subscribe()

  const pipeQueryResult =
    <R extends Result<T>, T>({
      key,
      queryStore,
      options$
    }: {
      key: string
      queryStore: ReturnType<typeof createQueryStore>
      options$: Observable<QueryOptions<T>>
    }): MonoTypeOperatorFunction<R> =>
    (stream) =>
      merge(
        stream,
        options$.pipe(
          tap(({ staleTime }) => {
            const query = queryStore.get(key)

            if (!query) return

            if (
              staleTime &&
              (query.lowestStaleTime === undefined ||
                staleTime < query.lowestStaleTime)
            ) {
              logger.log(key, "updated stale time with new lowest value", {
                staleTime
              })
              queryStore.update(key, {
                lowestStaleTime: staleTime
              })
            }
          }),
          switchMap(() => EMPTY)
        )
      )

  const pipeQueryFetch =
    <T>(_: {
      key: string
      queryStore: ReturnType<typeof createQueryStore>
      options$: Observable<QueryOptions<T>>
    }): MonoTypeOperatorFunction<T> =>
    (stream) =>
      stream

  const pipeQueryTrigger =
    <T>(_: {
      key: string
      options$: Observable<QueryOptions<T>>
    }): MonoTypeOperatorFunction<QueryTrigger> =>
    (stream) =>
      stream

  return {
    invalidateQueries,
    pipeQueryResult,
    pipeQueryFetch,
    pipeQueryTrigger,
    destroy: () => {
      staleUpdateSub.unsubscribe()
    }
  }
}
