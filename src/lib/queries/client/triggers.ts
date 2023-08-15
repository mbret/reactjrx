import {
  type Observable,
  distinctUntilChanged,
  filter,
  map,
  merge,
  skip
} from "rxjs"
import { type QueryOptions } from "./types"
import { type QueryStore } from "./store/createQueryStore"

export const createQueryTrigger = <T>({
  refetch$,
  options$,
  queryStore,
  key
}: {
  refetch$: Observable<{ ignoreStale: boolean }>
  options$: Observable<QueryOptions<T>>
  queryStore: QueryStore
  key: string
}) => {
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
    refetch$.pipe(
      map((event) => ({
        ...event,
        type: "refetch"
      }))
    ),
    enabledTrigger$.pipe(
      map(() => ({
        type: "enabled",
        ignoreStale: false
      }))
    )
  )
}
