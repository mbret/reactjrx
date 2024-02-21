import { type Observable, map, filter, distinctUntilChanged } from "rxjs"
import { type DefaultError } from "../../../types"
import { type QueryState } from "../types"
import { shallowEqual } from "../../../../../utils/shallowEqual"

export const whenNewData = <
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData
>(
  source: Observable<Partial<QueryState<TData, TError>>>
) =>
  source.pipe(
    filter((state) => state.status === "success"),
    map((state) => ({
      data: state.data,
      status: state.status,
      dataUpdatedAt: state.dataUpdatedAt
    })),
    distinctUntilChanged(shallowEqual)
  )
