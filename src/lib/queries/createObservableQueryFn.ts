import {
  type QueryFunctionContext,
  type QueryKey,
  skipToken,
} from "@tanstack/react-query"
import { defer, type Observable } from "rxjs"
import type { QueryClient$ } from "./QueryClientProvider$"

export type ObservableQueryFn<
  TQueryFnData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> =
  | ((context: QueryFunctionContext<TQueryKey>) => Observable<TQueryFnData>)
  | typeof skipToken
  | Observable<TQueryFnData>

/**
 * Bridges an Observable-based `queryFn` to the Promise-based `queryFn`
 * expected by TanStack Query. Shared by `useQuery$` and `useQueries$` so
 * both rely on the exact same subscription, caching and cancellation logic
 * (see {@link QueryClient$.runQuery}).
 */
export function createObservableQueryFn<
  TQueryFnData = unknown,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryClient$: QueryClient$,
  queryFn: ObservableQueryFn<TQueryFnData, TQueryKey> | undefined,
) {
  if (queryFn === skipToken || queryFn === undefined) {
    return queryFn
  }

  return (context: QueryFunctionContext<TQueryKey>) =>
    queryClient$.runQuery(
      context,
      defer(() => (typeof queryFn === "function" ? queryFn(context) : queryFn)),
    )
}
