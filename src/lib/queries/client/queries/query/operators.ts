import { type QueryState } from "@tanstack/react-query"
import { type DefaultError } from "../../types"
import { type Observable, scan, map } from "rxjs"

export const mergeResults =
  <TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData>(
    initialState: QueryState<TData, TError>
  ) =>
  (source: Observable<Partial<QueryState<TData, TError>>>) =>
    source.pipe(
      scan((acc, current) => {
        return {
          ...acc,
          ...current,
          status:
            (current.status === "pending" && acc.status === "error"
              ? acc.status
              : current.status) ?? acc.status
        }
      }, initialState)
    )

export const isQueryFinished = <
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData
>(
  source: Observable<Partial<QueryState<TData, TError>>>
) =>
  source.pipe(
    map(
      ({ status, fetchStatus }) =>
        fetchStatus === "idle" && (status === "success" || status === "error")
    )
  )
