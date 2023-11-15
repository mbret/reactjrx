import { type QueryStore } from "./createQueryStore"
import {
  NEVER,
  filter,
  map,
  merge,
  mergeMap,
  of,
  pairwise,
  startWith,
  takeUntil,
  tap,
  finalize,
  type MonoTypeOperatorFunction
} from "rxjs"
import { difference } from "../../../utils/difference"

export const createQueryListener = (
  store: QueryStore,
  onQuery: MonoTypeOperatorFunction<string>
) =>
  store.store$.pipe(
    map((store) => [...store.keys()]),
    startWith([]),
    pairwise(),
    mergeMap(([previousKeys, currentKeys]) => {
      const newKeys = difference(currentKeys, previousKeys)

      return merge(
        ...newKeys.map((key) => {
          const deleted$ = store.store$.pipe(
            map(() => store.get(key)),
            filter((item) => item === undefined)
          )
          // const noMoreRunners$ = store.store$.pipe(
          //   map(() => store.get(key)),
          //   filter((value) => (value?.runners ?? 0) === 0)
          // )

          return merge(NEVER, of(key)).pipe(
            tap(() => {
              // console.log("QUERY", key, "in")
            }),
            onQuery,
            finalize(() => {
              // console.log("QUERY", key, "complete")
            }),
            takeUntil(deleted$)
          )
        })
      )
    })
  )
