import { type Observable, of, switchMap, catchError, merge } from "rxjs"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { functionAsObservable } from "../../utils/functionAsObservable"
import { type QueryState } from "./types"
import { retryOnError } from "../../operators"
import { getDefaultState } from "./getDefaultState"
import { delayWhenVisibilityChange } from "./delayWhenVisibilityChange"
import { focusManager } from "../../focusManager"
import { type QueryOptions } from "../types"
import { delayWhenNetworkOnline } from "./delayWhenNetworkOnline"

export const executeQuery = <
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: QueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
    queryKey: TQueryKey
  }
): Observable<Partial<QueryState<TData, TError>>> => {
  type Result = Partial<QueryState<TData, TError>>

  const defaultFn = async () =>
    await Promise.reject(new Error("No query found"))

  const queryFn = options.queryFn ?? defaultFn

  const abortController = new AbortController()

  const fn$ =
    typeof queryFn === "function"
      ? // eslint-disable-next-line @typescript-eslint/promise-function-async
        functionAsObservable(() =>
          queryFn({
            meta: options.meta,
            queryKey: options.queryKey,
            signal: abortController.signal
          })
        )
      : queryFn

  const defaultState = getDefaultState(options)

  // console.log("executeSubject TRIGGER")

  return merge(
    of({
      status: "pending",
      fetchStatus: "fetching",
      data: defaultState.data,
      error: defaultState.error
    } satisfies Result),
    fn$.pipe(
      delayWhenVisibilityChange(focusManager),
      delayWhenNetworkOnline(),
      retryOnError<TQueryFnData>({
        retry: 3,
        retryDelay: 10
      }),
      switchMap((result) => {
        return of({
          status: "success",
          fetchStatus: "idle",
          data: result as TData | undefined
        } satisfies Result)
      }),
      catchError((error) => {
        return of({
          status: "error",
          fetchStatus: "idle",
          error
        } satisfies Result)
      })
    )
  )
}
