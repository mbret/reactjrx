import {
  type MonoTypeOperatorFunction,
  merge,
  of,
  switchMap,
  timer,
  tap,
  type Observable,
  withLatestFrom,
} from "rxjs"
import { type createQueryStore } from "../createQueryStore"
import { type QueryResult, type QueryOptions } from "../types"

type Result<T> = Partial<QueryResult<T>>

export const staleQuery =
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
    stream.pipe(
      withLatestFrom(options$),
      switchMap(([result, { staleTime = 0 }]) => {
        if (result.status !== "success" && result.status !== "error")
          return of(result)

        return merge(
          of(result),
          timer(staleTime).pipe(
            tap(() => {
              if (!queryStore.get(key)?.stale) {
                console.log(key, "marked stale")
                queryStore.update(key, { stale: true })
              }
            }),
            switchMap(() => of())
          )
        )
      })
    )
