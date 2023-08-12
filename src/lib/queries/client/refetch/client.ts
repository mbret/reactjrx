import {
  EMPTY,
  type MonoTypeOperatorFunction,
  type Observable,
  merge,
  switchMap,
  timer,
  map,
  distinctUntilChanged,
  filter,
  withLatestFrom,
  tap,
  share
} from "rxjs"
import { type createQueryStore } from "../store/createQueryStore"
import { Logger } from "../../../logger"
import {
  type QueryTrigger,
  type QueryOptions,
  type QueryResult
} from "../types"
import { isDefined } from "../../../utils/isDefined"

const logger = Logger.namespace("refetch")

type Result<T> = Partial<QueryResult<T>>

export const createRefetchClient = ({
  queryStore
}: {
  queryStore: ReturnType<typeof createQueryStore>
}) => {
  const pipeQueryResult =
    <R extends Result<T>, T>({
      options$
    }: {
      key: string
      queryStore: ReturnType<typeof createQueryStore>
      options$: Observable<QueryOptions<T>>
      refetch$: Observable<QueryTrigger>
    }): MonoTypeOperatorFunction<R> =>
    (stream) => {
      const sharedStream = stream.pipe(share())

      return merge(
        sharedStream,
        sharedStream.pipe(
          filter(
            (result) => !!result.data && result.fetchStatus !== "fetching"
          ),
          distinctUntilChanged((prev, curr) => prev.data === curr.data),
          withLatestFrom(options$),
          map(([, { refetchInterval }]) => refetchInterval),
          filter(isDefined),
          switchMap((refetchInterval) => {
            if (typeof refetchInterval === "number") {
              return timer(refetchInterval).pipe(
                map(() => ({
                  type: "refetch",
                  ignoreStale: true
                })),
                switchMap(() => EMPTY)
              )
            }

            return EMPTY
          })
        )
      )
    }

  const pipeQueryTrigger =
    <T>({
      key
    }: {
      key: string
      options$: Observable<QueryOptions<T>>
    }): MonoTypeOperatorFunction<QueryTrigger> =>
    (stream) => {
      return merge(
        stream.pipe(
          tap(({ ignoreStale }) => {
            const query = queryStore.get(key)

            if (query && ignoreStale && !query.isStale) {
              logger.log(key, "marked stale by trigger!")
              queryStore.update(key, {
                isStale: true
              })
            }
          })
        )
      )
    }

  return {
    pipeQueryResult,
    pipeQueryTrigger,
    destroy: () => {}
  }
}
