import { type QueryState } from "@tanstack/react-query"
import { type DefaultError } from "../../types"
import { type Observable, scan, map } from "rxjs"
import { type QueryOptions } from "../types"
import { replaceData } from "../utils"

export const mergeResults =
  <TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData>({
    getOptions,
    getState,
    initialState
  }: {
    initialState: QueryState<TData, TError>
    getState: () => QueryState<TData, TError>
    getOptions: () => QueryOptions<TQueryFnData, TError, TData, any>
  }) =>
  (source: Observable<Partial<QueryState<TData, TError>>>) =>
    source.pipe(
      scan((acc, current) => {
        const currentData = current.data

        const newData =
          currentData && currentData !== acc.data
            ? replaceData(getState().data, currentData, getOptions())
            : acc.data

        return {
          ...acc,
          ...current,
          data: newData,
          dataUpdateCount:
            current.status === "success" && acc.status !== "success"
              ? acc.dataUpdateCount + 1
              : acc.dataUpdateCount,
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
