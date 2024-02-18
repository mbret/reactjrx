import { type Observable, distinctUntilChanged, scan } from "rxjs"
import { shallowEqual } from "../../utils/shallowEqual"
import { type QueryResult } from "./types"

export const mergeResults = <T>(
  stream$: Observable<Partial<QueryResult<T>>>
): Observable<QueryResult<T>> =>
  stream$.pipe(
    scan(
      (acc: QueryResult<T>, current) => {
        return {
          ...acc,
          ...current
        }
      },
      {
        data: undefined,
        error: undefined,
        fetchStatus: "idle",
        status: "loading"
      }
    ),
    distinctUntilChanged(
      ({ data: prevData, ...prev }, { data: currData, ...curr }) =>
        shallowEqual(prev, curr) && shallowEqual(prevData, currData)
    )
  )
