import { type Observable, distinctUntilChanged, scan } from "rxjs"
import { type MutationResult,  } from "./types"
import { shallowEqual } from "../../../utils/shallowEqual"

export const mergeResults = <T>(
  stream$: Observable<Partial<MutationResult<T>>>
): Observable<MutationResult<T>> =>
  stream$.pipe(
    scan(
      (acc: MutationResult<T>, current) => {
        return {
          ...acc,
          ...current
        }
      },
      {
        data: undefined,
        error: undefined,
        // fetchStatus: "idle",
        status: "loading"
      }
    ),
    distinctUntilChanged(
      ({ data: prevData, ...prev }, { data: currData, ...curr }) =>
        shallowEqual(prev, curr) && shallowEqual(prevData, currData)
    )
  )
