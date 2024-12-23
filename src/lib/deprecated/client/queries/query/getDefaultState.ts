import { type QueryKey } from "../../keys/types"
import { type InitialDataFunction, type QueryOptions } from "../types"
import { type QueryState } from "./types"

export function getDefaultState<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey
>(
  options: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
): QueryState<TData, TError> {
  const data =
    typeof options.initialData === "function"
      ? (options.initialData as InitialDataFunction<TData>)()
      : options.initialData

  const hasData = typeof data !== "undefined"

  const initialDataUpdatedAt = hasData
    ? typeof options.initialDataUpdatedAt === "function"
      ? (options.initialDataUpdatedAt as () => number | undefined)()
      : options.initialDataUpdatedAt
    : 0

  return {
    data,
    dataUpdateCount: 0,
    dataUpdatedAt: hasData ? (initialDataUpdatedAt ?? Date.now()) : 0,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    isInvalidated: false,
    status: hasData ? "success" : "pending",
    fetchStatus: "idle"
  }
}
