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
  refetch$: Observable<void>
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
        force: false
      }))
    ),
    refetch$.pipe(
      map(() => ({
        type: "refetch",
        /**
         * bypass stale
         */
        force: true
      }))
    ),
    enabledTrigger$.pipe(
      map(() => ({
        type: "enabled",
        force: false
      }))
    )
  ).pipe(
    tap((trigger) => {
      console.log("reactjrx query trigger", trigger)
    })
  )
}
