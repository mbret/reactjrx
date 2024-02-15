import { type QueryState } from "@tanstack/react-query"
import { type DefaultError } from "../../types"
import { type Observable, scan, map, takeWhile } from "rxjs"
import { type QueryOptions } from "../types"
import { replaceData } from "../utils"

export const reduceState =
  <TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData>({
    getOptions,
    getState,
    initialState
  }: {
    initialState: QueryState<TData, TError>
    getState: () => QueryState<TData, TError>
    getOptions: () => QueryOptions<TQueryFnData, TError, TData, any>
  }) =>
  (
    source: Observable<{
      command: "invalidate" | "cancel" | "reset" | "setData" | "execute"
      state: Partial<QueryState<TData, TError>>
    }>
  ) =>
    source.pipe(
      scan((acc, { command, state: current }) => {
        if (command === "reset") return { ...acc, ...current }

        if (command === "cancel") {
          const status =
            acc.status === "pending" ? "pending" : current.status ?? acc.status

          return { ...acc, ...current, status }
        }

        const currentData = current.data

        const weHaveNewData =
          currentData !== undefined && currentData !== acc.data
        const weHaveDataKeyInCurrent = "data" in current

        const newSuccessStatus = current.status === "success"

        const hasData = acc.data !== undefined
        const hasError = acc.error !== undefined || acc.error !== null
        const status = current.status ?? acc.status

        const newData = weHaveNewData
          ? replaceData(getState().data, currentData, getOptions())
          : weHaveDataKeyInCurrent
            ? current.data
            : acc.data

        const previousStatusIsSuccessOrError =
          acc.status === "error" || acc.status === "success"

        const errorUpdateCount =
          current.status === "error" &&
          ((acc.status === "error" && acc.fetchStatus === "fetching") ||
            acc.status !== "error")
            ? acc.errorUpdateCount + 1
            : acc.errorUpdateCount

        const dataUpdateCount = weHaveNewData
          ? acc.dataUpdateCount + 1
          : current.dataUpdateCount ?? acc.dataUpdateCount

        const newPendingStatusOnHold =
          current.status === "pending" &&
          previousStatusIsSuccessOrError &&
          // (dataUpdateCount !== 0 || errorUpdateCount !== 0)
          (hasData || hasError)

        const error = status === "pending" ? null : current.error ?? acc.error

        console.log("mergeResults", {
          weHaveNewData,
          weHaveDataKeyInCurrent,
          previousStatusIsSuccessOrError,
          newPendingStatusOnHold,
          dataUpdateCount,
          error
        })

        return {
          ...acc,
          ...current,
          status,
          error,
          errorUpdateCount,
          ...(newSuccessStatus && {
            isInvalidated: false
          }),
          data: newData,
          dataUpdateCount,
          ...(newPendingStatusOnHold && {
            status: acc.status
          })
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
    }, true)
  )
