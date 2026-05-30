import {
  type DefaultError,
  type QueriesPlaceholderDataFunction,
  type QueryClient,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query"
import {
  createObservableQueryFn,
  type ObservableQueryFn,
} from "./createObservableQueryFn"
import { useQueryClient$ } from "./QueryClientProvider$"

type MAXIMUM_DEPTH = 20

type UseQuery$OptionsForUseQueries<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<
  UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  "queryFn" | "placeholderData"
> & {
  queryFn?: ObservableQueryFn<TQueryFnData, TQueryKey>
  placeholderData?: TQueryFnData | QueriesPlaceholderDataFunction<TQueryFnData>
}

type GetUseQuery$Options<T> = T extends {
  queryFn?: ObservableQueryFn<infer TQueryFnData, infer TQueryKey>
  // biome-ignore lint/suspicious/noExplicitAny: select can narrow from any source shape
  select?: (data: any) => infer TData
}
  ? UseQuery$OptionsForUseQueries<
      TQueryFnData,
      DefaultError,
      unknown extends TData ? TQueryFnData : TData,
      TQueryKey extends QueryKey ? TQueryKey : QueryKey
    >
  : UseQuery$OptionsForUseQueries

type GetUseQuery$Result<T> = T extends {
  // biome-ignore lint/suspicious/noExplicitAny: queryFnData is inferred from the source shape
  queryFn?: ObservableQueryFn<infer TQueryFnData, any>
  // biome-ignore lint/suspicious/noExplicitAny: select can narrow from any source shape
  select?: (data: any) => infer TData
}
  ? UseQueryResult<unknown extends TData ? TQueryFnData : TData, DefaultError>
  : UseQueryResult

/**
 * Mirrors TanStack's `QueriesOptions`, but each query takes an Observable-based
 * `queryFn` (see {@link ObservableQueryFn}) instead of a Promise-based one. The
 * recursion preserves per-element tuple inference at the call site.
 */
export type QueriesOptions$<
  // biome-ignore lint/suspicious/noExplicitAny: mirrors TanStack's QueriesOptions constraint
  T extends Array<any>,
  // biome-ignore lint/suspicious/noExplicitAny: mirrors TanStack's QueriesOptions constraint
  TResults extends Array<any> = [],
  TDepth extends ReadonlyArray<number> = [],
> = TDepth["length"] extends MAXIMUM_DEPTH
  ? Array<UseQuery$OptionsForUseQueries>
  : T extends []
    ? []
    : T extends [infer Head]
      ? [...TResults, GetUseQuery$Options<Head>]
      : T extends [infer Head, ...infer Tails]
        ? QueriesOptions$<
            [...Tails],
            [...TResults, GetUseQuery$Options<Head>],
            [...TDepth, 1]
          >
        : ReadonlyArray<unknown> extends T
          ? T
          : Array<UseQuery$OptionsForUseQueries>

/**
 * Mirrors TanStack's `QueriesResults`, mapping each Observable-based query
 * option to its `UseQueryResult`.
 */
export type QueriesResults$<
  // biome-ignore lint/suspicious/noExplicitAny: mirrors TanStack's QueriesResults constraint
  T extends Array<any>,
  // biome-ignore lint/suspicious/noExplicitAny: mirrors TanStack's QueriesResults constraint
  TResults extends Array<any> = [],
  TDepth extends ReadonlyArray<number> = [],
> = TDepth["length"] extends MAXIMUM_DEPTH
  ? Array<UseQueryResult>
  : T extends []
    ? []
    : T extends [infer Head]
      ? [...TResults, GetUseQuery$Result<Head>]
      : T extends [infer Head, ...infer Tails]
        ? QueriesResults$<
            [...Tails],
            [...TResults, GetUseQuery$Result<Head>],
            [...TDepth, 1]
          >
        : { [K in keyof T]: GetUseQuery$Result<T[K]> }

export function useQueries$<
  // biome-ignore lint/suspicious/noExplicitAny: mirrors TanStack's useQueries constraint
  T extends Array<any>,
  TCombinedResult = QueriesResults$<T>,
>(
  {
    queries,
    ...options
  }: {
    queries: readonly [...QueriesOptions$<T>]
    combine?: (result: QueriesResults$<T>) => TCombinedResult
    subscribed?: boolean
  },
  queryClient?: QueryClient,
): TCombinedResult {
  const _queryClient = useQueryClient(queryClient)
  const queryClient$ = useQueryClient$()

  const transformedQueries = queries.map(({ queryFn, ...query }) => ({
    ...query,
    queryFn: createObservableQueryFn(queryClient$, _queryClient, queryFn),
  }))

  return useQueries(
    {
      /**
       * The Observable `queryFn` has been bridged to a Promise `queryFn`, so
       * `transformedQueries` matches TanStack's expected shape at runtime, but
       * the mapped tuple type is widened by `Array.prototype.map` and can't be
       * re-narrowed without the cast.
       */
      queries: transformedQueries as Parameters<
        typeof useQueries<T, TCombinedResult>
      >[0]["queries"],
      combine: options.combine as
        | ((result: unknown) => TCombinedResult)
        | undefined,
      subscribed: options.subscribed,
    },
    queryClient,
  )
}
