import { type QueryState } from "@tanstack/react-query"
import { type DefaultError } from "../../types"
import { type Observable, scan, map, takeWhile } from "rxjs"
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
        // console.log("mergeResults", { acc, current })

        const currentData = current.data

        const newData =
          currentData !== undefined && currentData !== acc.data
            ? replaceData(getState().data, currentData, getOptions())
            : acc.data

        return {
          ...acc,
          ...current,
          errorUpdateCount:
            current.status === "error" &&
            ((acc.status === "error" && acc.fetchStatus === "fetching") ||
              acc.status !== "error")
              ? acc.errorUpdateCount + 1
              : acc.errorUpdateCount,
          data: newData,
          dataUpdateCount:
            current.fetchStatus === "idle" && acc.fetchStatus !== "idle"
              ? acc.dataUpdateCount + 1
              : acc.dataUpdateCount,
          // status: current.status ?? acc.status
          status:
            (current.status === "pending" &&
            (acc.status === "error" || acc.status === "success")
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

export const takeUntilFinished = <
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData
>(
  source: Observable<Partial<QueryState<TData, TError>>>
) =>
  source.pipe(
    takeWhile((result) => {
      const isFetchingOrPaused = result.fetchStatus !== "idle"

      return isFetchingOrPaused
    }, true),
  )
