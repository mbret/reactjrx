import {
  type Observable,
  of,
  switchMap,
  merge,
  map,
} from "rxjs"
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

  return merge(
    of({
      status: "pending",
      fetchStatus: "fetching",
      data: defaultState.data,
      error: defaultState.error
    } satisfies Result),
    fn$.pipe(
      map(
        (data): Result => ({
          data: data as any,
          error: null
        })
      ),
      delayWhenVisibilityChange(focusManager),
      delayWhenNetworkOnline(),
      retryOnError<Result, TError>({
        retry: options.retry,
        retryDelay: options.retryDelay,
        catchError: (attempt, error) =>
          of({
            status: "error",
            fetchStatus: "idle",
            fetchFailureCount: attempt,
            errorUpdateCount: 1,
            error
          } satisfies Result),
        caughtError: (attempt, error) =>
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          of({
            fetchFailureCount: attempt,
            fetchFailureReason: error
          } as Result)
      }),
      switchMap((state) => {
        if (state.fetchFailureReason ?? state.error) return of(state)

        return of({
          ...state,
          status: "success",
          fetchStatus: "idle"
        } satisfies Result)
      })
    )
  )
}
