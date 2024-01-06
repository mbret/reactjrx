import { type Observable, distinctUntilChanged, scan } from "rxjs"
import { shallowEqual } from "../../utils/shallowEqual"
import { type QueryResult } from "./types"
import { type RetryBackoffConfig, retryBackoff } from "../../utils/retryBackoff"

export const retryOnError = <T>({
  retryDelay,
  retry,
  ...rest
}: {
  retry?: false | number | ((attempt: number, error: any) => boolean)
  retryDelay?: number | ((failureCount: number, error: any) => number)
} & Omit<RetryBackoffConfig<T>, "initialInterval">) =>
  retryBackoff({
    initialInterval: typeof retryDelay === "number" ? retryDelay : 100,
    ...(typeof retry === "function"
      ? {
          shouldRetry: retry
        }
      : {
          maxRetries: retry === false ? 0 : retry ?? 0
        }),
    ...rest
  })

export const mergeResults = <T>(
  stream$: Observable<Partial<QueryResult<T>>>
): Observable<QueryResult<T>> =>
  stream$.pipe(
    scan(
      (acc: QueryResult<T>, current) => {
        return {
          ...acc,
          ...current
        }
      },
      {
        data: undefined,
        error: undefined,
        fetchStatus: "idle",
        status: "loading"
      }
    ),
    distinctUntilChanged(
      ({ data: prevData, ...prev }, { data: currData, ...curr }) =>
        shallowEqual(prev, curr) && shallowEqual(prevData, currData)
    )
  )
