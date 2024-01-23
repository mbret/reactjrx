import { type Observable, of, switchMap, catchError, merge, tap } from "rxjs"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { functionAsObservable } from "../../utils/functionAsObservable"
import { type QueryOptions } from "../types"
import { type QueryState } from "./types"
import { retryOnError } from "../../operators"
import { getDefaultState } from "./getDefaultState"

export const executeQuery = <
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
): Observable<Partial<QueryState<TData, TError>>> => {
  type Result = Partial<QueryState<TData, TError>>

  const defaultFn = async () =>
    await Promise.reject(new Error("No query found"))

  const queryFn = options.queryFn ?? defaultFn

  const fn$ =
    typeof queryFn === "function"
      ? // eslint-disable-next-line @typescript-eslint/promise-function-async
        functionAsObservable(() => queryFn({ meta: options.meta }))
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
