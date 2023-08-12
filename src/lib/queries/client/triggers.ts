import {
  type Observable,
  distinctUntilChanged,
  filter,
  map,
  merge,
  of,
  skip,
  tap
} from "rxjs"
import { type QueryOptions } from "./types"

export const createQueryTrigger = <T>({
  refetch$,
  options$
}: {
  refetch$: Observable<{ ignoreStale: boolean }>
  options$: Observable<QueryOptions<T>>
}) => {
  const initialTrigger$ = of("initial")

  const enabledOption$ = options$.pipe(
    map(({ enabled = true }) => enabled),
    distinctUntilChanged()
  )

  const enabledTrigger$ = enabledOption$.pipe(
    skip(1),
    filter((enabled) => enabled)
  )

  return merge(
    initialTrigger$.pipe(
      map(() => ({
        type: "initial",
        ignoreStale: false
      }))
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
