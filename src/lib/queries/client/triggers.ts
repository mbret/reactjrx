import {
  type Observable,
  distinctUntilChanged,
  filter,
  map,
  merge,
  skip
} from "rxjs"
import { type QueryTrigger, type QueryOptions } from "./types"
import { type QueryStore } from "./oldqueries/store/createQueryStore"

export const createQueryTrigger = <T>({
  options$,
  queryStore,
  key
}: {
  options$: Observable<QueryOptions<T>>
  queryStore: QueryStore
  key: string
}): Observable<QueryTrigger> => {
  const enabledOption$ = options$.pipe(
    map(({ enabled = true }) => enabled),
    distinctUntilChanged()
  )

  const enabledTrigger$ = enabledOption$.pipe(
    skip(1),
    filter((enabled) => enabled)
  )

  return merge(
    queryStore.queryTrigger$.pipe(
      filter((event) => key === event.key),
      map(({ trigger }) => trigger)
    ),
    enabledTrigger$.pipe(
      map(() => ({
        type: "enabled" as const,
        ignoreStale: false
      }))
    )
  )
}
