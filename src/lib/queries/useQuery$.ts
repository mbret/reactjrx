import {
  DefaultError,
  QueryClient,
  QueryFunctionContext,
  QueryKey,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  hashKey
} from "@tanstack/react-query"
import { useRef } from "react"
import {
  defer,
  delay,
  Observable,
  Subscription,
  take,
} from "rxjs"
import { useQueryClient$ } from "./QueryClientProvider$"

export function useQuery$<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    "queryFn"
  > & {
    queryFn:
      | ((context: QueryFunctionContext<TQueryKey>) => Observable<TQueryFnData>)
      | Observable<TQueryFnData>
  },
  queryClient?: QueryClient
) {
  const query$ = useRef<Observable<TQueryFnData>>()
  const sub = useRef<Subscription>()
  const _queryClient = useQueryClient(queryClient)
  const reactJrxQueryClient = useQueryClient$()

  const queryFnAsync = (context: QueryFunctionContext<TQueryKey>) => {
    return new Promise<TQueryFnData>((resolve, reject) => {
      /**
       * Auto unsubscribe when there is no more observers.
       */
      // const unsub = _queryClient.getQueryCache().subscribe((d) => {
      //   if (
      //     d.type === "observerRemoved" &&
      //     d.query.queryHash === hashKey(context.queryKey) &&
      //     d.query.observers.length === 0
      //   ) {
      //     unsub()
      //     sub.current?.unsubscribe()
      //   }
      // })

      const getSource = () =>
        defer(() =>
          typeof options.queryFn === "function"
            ? options.queryFn(context)
            : options.queryFn
        )

      const queryHash = hashKey(context.queryKey)

      const queryCacheEntry =
        reactJrxQueryClient.getQuery(queryHash) ??
        reactJrxQueryClient.setQuery(
          context.queryKey,
          getSource(),
          context.signal
        )

      const query$ = queryCacheEntry.query$

      query$
        .pipe(
          take(1),
          /**
           * If several values are emitted during this delay, we will only
           * keep the last value. This is unfortunate but it's the best we can do
           * for now.
           */
          delay(1)
        )
        .subscribe({
          error: (error) => {
            return reject(error)
          },
          complete: () => {
            if (queryCacheEntry?.lastData === undefined) {
              console.log(
                "cancelled due to stream completing without data",
                queryCacheEntry?.lastData
              )

              _queryClient.cancelQueries({
                queryKey: context.queryKey,
                exact: true
              })

              return resolve(undefined as TQueryFnData)
            }

            resolve(queryCacheEntry.lastData.value as TQueryFnData)

            if (queryCacheEntry?.isCompleted === false) {
              setTimeout(() => {
                _queryClient?.refetchQueries({
                  queryKey: context.queryKey,
                  exact: true
                })
              })
            }
          }
        })
    })
  }

  const result = useQuery<TQueryFnData, TError, TData, TQueryKey>(
    {
      ...options,
      queryFn: queryFnAsync,

      meta: {
        query$
      }
    },
    queryClient
  )

  return result
}
