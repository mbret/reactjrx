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
  share
} from "rxjs"
import { type createQueryStore } from "../store/createQueryStore"
import {
  type QueryTrigger,
  type DeprecatedQueryOptions,
  type QueryResult
} from "../../types"
import { isDefined } from "../../../../utils/isDefined"
import { type QueryKey } from "../../keys/types"

type Result<T> = Partial<QueryResult<T>>

export const createRefetchClient = (_: {
  queryStore: ReturnType<typeof createQueryStore>
}) => {
  const pipeQueryResult =
    <R extends Result<T>, T>({
      options$
    }: {
      key: string
      queryStore: ReturnType<typeof createQueryStore>
      options$: Observable<DeprecatedQueryOptions<T>>
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

  const refetchQueries = (_: { queryKey: QueryKey }) => {}

  return {
    pipeQueryResult,
    refetchQueries
  }
}
