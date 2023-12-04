import { type Observable, distinctUntilChanged, scan } from "rxjs"
import { type MutationState } from "./types"
import { shallowEqual } from "../../../utils/shallowEqual"
import { getDefaultMutationState } from "./defaultMutationState"

export const mergeResults = <T>(
  stream$: Observable<Partial<MutationState<T>>>
): Observable<MutationState<T>> =>
  stream$.pipe(
    scan((acc: MutationState<T>, current) => {
      return {
        ...acc,
        ...current,
        data: current.data ?? acc.data,
        error: current.error ?? acc.error
      }
    }, getDefaultMutationState<T>()),
    distinctUntilChanged(
      ({ data: prevData, ...prev }, { data: currData, ...curr }) =>
        shallowEqual(prev, curr) && shallowEqual(prevData, currData)
    )
  )
