import { type Observable, distinctUntilChanged, scan } from "rxjs"
import { type MutationState } from "./types"
import { shallowEqual } from "../../../utils/shallowEqual"
import { getDefaultMutationState } from "./defaultMutationState"

export const mergeResults = <
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(
  stream$: Observable<
    Partial<MutationState<TData, TError, TVariables, TContext>>
  >
): Observable<MutationState<TData, TError, TVariables, TContext>> =>
  stream$.pipe(
    scan((acc: MutationState<TData, TError, TVariables, TContext>, current) => {
      return {
        ...acc,
        ...current,
        data: current.data ?? acc.data,
        error: current.error ?? acc.error
      }
    }, getDefaultMutationState<TData, TError, TVariables, TContext>()),
    distinctUntilChanged(
      ({ data: prevData, ...prev }, { data: currData, ...curr }) =>
        shallowEqual(prev, curr) && shallowEqual(prevData, currData)
    )
  )
