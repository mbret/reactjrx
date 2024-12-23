import { type QueryKey } from "../../client/keys/types"
import { type QueryObserverResult } from "../../client/queries/observer/types"
import { type Query } from "../../client/queries/query/Query"
import { type ThrowOnError } from "../../client/queries/types"
import { type QueryErrorResetBoundaryValue } from "./QueryErrorResetBoundary"

export function shouldThrowError<T extends (...args: any[]) => boolean>(
  throwError: boolean | T | undefined,
  params: Parameters<T>
): boolean {
  // Allow throwError function to override throwing behavior on a per-error basis
  if (typeof throwError === "function") {
    return throwError(...params)
  }

  return !!throwError
}

export const getHasError = <
  TData,
  TError,
  TQueryFnData,
  TQueryData,
  TQueryKey extends QueryKey
>({
  result,
  errorResetBoundary,
  throwOnError,
  query
}: {
  result: QueryObserverResult<TData, TError>
  errorResetBoundary: QueryErrorResetBoundaryValue
  throwOnError: ThrowOnError<TQueryFnData, TError, TQueryData, TQueryKey>
  query: Query<TQueryFnData, TError, TQueryData, TQueryKey> | undefined
}) => {
  return (
    result.isError &&
    !errorResetBoundary.isReset() &&
    !result.isFetching &&
    query &&
    shouldThrowError(throwOnError, [result.error, query])
  )
}
