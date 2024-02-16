import {
  type Observable,
  of,
  switchMap,
  merge,
  map,
  delay,
  tap,
  ignoreElements,
  endWith,
  share,
  type OperatorFunction
} from "rxjs"
import { type QueryKey } from "../../keys/types"
import { type DefaultError } from "../../types"
import { makeObservable } from "../../utils/makeObservable"
import { type QueryFunctionContext, type QueryState } from "./types"
import { retryOnError } from "../../operators"
import { type QueryOptions } from "../types"
import { delayOnNetworkMode } from "./delayOnNetworkMode"
import { onlineManager } from "../../onlineManager"
import { delayWhenVisibilityChange } from "./delayWhenVisibilityChange"
import { focusManager } from "../../focusManager"

export const executeQuery = <
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: QueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
    queryKey: TQueryKey
    onNetworkRestored: OperatorFunction<Partial<QueryState<TData, TError>>, any>
    onSignalConsumed: () => void
  }
): Observable<Partial<QueryState<TData, TError>>> => {
  type Result = Partial<QueryState<TData, TError>>

  const defaultFn = async () =>
    await Promise.reject(new Error("No query found"))

  let fnIsComplete = false
  const queryFn = options.queryFn ?? defaultFn
  const abortController = new AbortController()

  const queryFnContext: Omit<QueryFunctionContext<TQueryKey>, "signal"> = {
    meta: options.meta,
    queryKey: options.queryKey
  }

  // Adds an enumerable signal property to the object that
  // which sets abortSignalConsumed to true when the signal
  // is read.
  const addSignalProperty = (object: unknown) => {
    Object.defineProperty(object, "signal", {
      enumerable: true,
      get: () => {
        options.onSignalConsumed()
        return abortController.signal
      }
    })
  }

  addSignalProperty(queryFnContext)

  const fn$ =
    typeof queryFn === "function"
      ? // eslint-disable-next-line @typescript-eslint/promise-function-async
        makeObservable(() =>
          queryFn(queryFnContext as QueryFunctionContext<TQueryKey>)
        )
      : queryFn

  const execution$ = fn$.pipe(
    tap({
      complete: () => {
        fnIsComplete = true
      }
    }),
    map(
      (data): Result => ({
        data: data as unknown as TData,
        error: null
      })
    ),
    delayWhenVisibilityChange(focusManager),
    delayOnNetworkMode<TData, TError>(options),
    retryOnError<Result, TError>({
      retry: options.retry,
      retryDelay: options.retryDelay,
      catchError: (attempt, error) =>
        of({
          status: "error",
          fetchStatus: "idle",
          fetchFailureCount: attempt,
          fetchFailureReason: error,
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
      if (!("data" in state)) return of(state)

      return of({
        ...state,
        status: "success",
        fetchStatus: "idle",
        fetchFailureCount: 0,
        fetchFailureReason: null,
        dataUpdatedAt: new Date().getTime()
      } satisfies Result).pipe(
        /**
         * Because we don't know yet whether the fn is an observable or a promise we wait
         * for next tick and check if the function has been complete. This prevent having
         * two dispatch for promise where we would have extra "fetching" & "idle" dispatch
         *
         * @important
         * Another reason why this delay is necessary is to pass RQ tests. This is because
         * their flow expect a sequence of results to sometimes happens in a specific
         * way. If we have non promise function, we have results faster than what RQ expect
         * due to this library architecture and some variables are impossible to determine
         * correctly (eg: isFetchedAfterMount). There is nothing wrong, it's just a way to
         * force any function as promise (or more specifically to return in next tick).
         *
         * There is in theory no problem associated to that.
         */
        delay(1),
        map((state) =>
          fnIsComplete
            ? state
            : ({ ...state, fetchStatus: "fetching" } satisfies Result)
        )
      )
    }),
    share()
  )

  /**
   * When the fn complete we can release the fetch status, if it was already released
   * before shallow compare will not update the state, otherwise it's our chance to catch
   * the end of observable fn.
   */
  const emitOnComplete$ = execution$.pipe(
    ignoreElements(),
    endWith({ fetchStatus: "idle" } satisfies Result)
  )

  const initialResult$ = of({
    status: "pending",
    fetchStatus: onlineManager.isOnline() ? "fetching" : "paused"
    // data: defaultState.data,
    // error: defaultState.error
  } satisfies Result)

  return merge(initialResult$, execution$, emitOnComplete$)
}
