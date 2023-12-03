import { type Observable, distinctUntilChanged, scan } from "rxjs"
import { type MutationResult } from "./types"
import { shallowEqual } from "../../../utils/shallowEqual"

export const mergeResults = <T>(
  stream$: Observable<Partial<MutationResult<T>>>
): Observable<MutationResult<T>> =>
  stream$.pipe(
    scan(
      (acc: MutationResult<T>, current) => {
        return {
          ...acc,
          ...current,
          data: current.data ?? acc.data,
          error: current.error ?? acc.error
        }
      },
      {
        data: undefined,
        error: undefined,
        status: "pending"
      }
    ),
    distinctUntilChanged(
      ({ data: prevData, ...prev }, { data: currData, ...curr }) =>
        shallowEqual(prev, curr) && shallowEqual(prevData, currData)
    )
  )
