import { lastValueFrom, noop } from "rxjs"
import { serializeKey } from "./keys/serializeKey"
import { type MutationKey } from "./mutations/types"
import { MutationCache } from "./mutations/cache/MutationCache"
import { type MutationObserverOptions } from "./mutations/observers/types"
import { compareKeys, partialMatchKey } from "./keys/compareKeys"
import { type MutationOptions } from "./mutations/mutation/types"
import { QueryCache } from "./queries/cache/QueryCache"
import {
  type DataTag,
  type Updater,
  type FetchQueryOptions,
  type QueryFilters,
  type SetDataOptions
} from "./queries/types"
import { type DefaultError } from "./types"
import { type QueryKey } from "./keys/types"
import {
  type DefaultedQueryObserverOptions,
  type QueryObserverOptions
} from "./queries/observer/types"
import { functionalUpdate, hashQueryKeyByOptions } from "./queries/utils"
import { type NoInfer } from "../../utils/types"

export interface DefaultOptions<TError = DefaultError> {
  queries?: Omit<QueryObserverOptions<unknown, TError>, "suspense">
  mutations?: MutationObserverOptions<unknown, TError, unknown, unknown>
}

export interface QueryClientConfig {
  queryCache?: QueryCache
  mutationCache?: MutationCache
  defaultOptions?: DefaultOptions
}

export class QueryClient {
  readonly #mutationCache: MutationCache
  readonly #queryCache: QueryCache
  readonly #mutationDefaults = new Map()
  readonly #queryDefaults = new Map()
  readonly #defaultOptions: DefaultOptions

  #destroy = () => {}

  constructor({
    mutationCache,
    queryCache,
    defaultOptions
  }: QueryClientConfig = {}) {
    this.#mutationCache = mutationCache ?? new MutationCache()
    this.#queryCache = queryCache ?? new QueryCache()
    this.#defaultOptions = defaultOptions ?? {}
  }

  mount() {
    this.#destroy = this.#queryCache.client.start()
  }

  unmount() {
    this.#destroy()
  }

  getMutationCache() {
    return this.#mutationCache
  }

  getQueryCache() {
    return this.#queryCache
  }

  defaultMutationOptions<T extends MutationOptions<any, any, any, any>>(
    options?: T
  ): T {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      ...(options?.mutationKey &&
        this.getMutationDefaults(options.mutationKey)),
      ...options
    } as T
  }

  defaultQueryOptions<
    TQueryFnData = unknown,
    TError = DefaultError,
    TData = TQueryFnData,
    TQueryData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey,
    TPageParam = never
  >(
    options?:
      | QueryObserverOptions<
          TQueryFnData,
          TError,
          TData,
          TQueryData,
          TQueryKey,
          TPageParam
        >
      | DefaultedQueryObserverOptions<
          TQueryFnData,
          TError,
          TData,
          TQueryData,
          TQueryKey
        >
  ): DefaultedQueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  > {
    if (options?._defaulted) {
      return options as DefaultedQueryObserverOptions<
        TQueryFnData,
        TError,
        TData,
        TQueryData,
        TQueryKey
      >
    }

    const defaultedOptions = {
      ...this.#defaultOptions.queries,
      ...(options?.queryKey && this.getQueryDefaults(options.queryKey)),
      ...options,
      _defaulted: true
    }

    if (!defaultedOptions.queryHash) {
      defaultedOptions.queryHash = hashQueryKeyByOptions(
        defaultedOptions.queryKey,
        defaultedOptions
      )
    }

    // dependent default values
    if (typeof defaultedOptions.refetchOnReconnect === "undefined") {
      defaultedOptions.refetchOnReconnect =
        defaultedOptions.networkMode !== "always"
    }
    if (typeof defaultedOptions.throwOnError === "undefined") {
      defaultedOptions.throwOnError = !!defaultedOptions.suspense
    }

    if (
      typeof defaultedOptions.networkMode === "undefined" &&
      defaultedOptions.persister
    ) {
      defaultedOptions.networkMode = "offlineFirst"
    }

    return defaultedOptions as DefaultedQueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
  }

  async fetchQuery<
    TQueryFnData,
    TError = DefaultError,
    TData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey,
    TPageParam = never
  >(
    options: FetchQueryOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryKey,
      TPageParam
    >
  ): Promise<TData> {
    const defaultedOptions = this.defaultQueryOptions(options)

    // https://github.com/tannerlinsley/react-query/issues/652
    if (typeof defaultedOptions.retry === "undefined") {
      defaultedOptions.retry = false
    }

    const query = this.#queryCache.build(this, defaultedOptions)

    return query.isStaleByTime(defaultedOptions.staleTime)
      ? await query.fetch(defaultedOptions)
      : await Promise.resolve(query.state.data as TData)
  }

  async prefetchQuery<
    TQueryFnData = unknown,
    TError = DefaultError,
    TData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey
  >(
    options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>
  ): Promise<void> {
    await this.fetchQuery(options).then(noop).catch(noop)
  }

  setQueryData<
    TQueryFnData = unknown,
    TaggedQueryKey extends QueryKey = QueryKey,
    TInferredQueryFnData = TaggedQueryKey extends DataTag<
      unknown,
      infer TaggedValue
    >
      ? TaggedValue
      : TQueryFnData
  >(
    queryKey: TaggedQueryKey,
    updater: Updater<
      NoInfer<TInferredQueryFnData> | undefined,
      NoInfer<TInferredQueryFnData> | undefined
    >,
    options?: SetDataOptions
  ): TInferredQueryFnData | undefined {
    const query = this.#queryCache.find<TInferredQueryFnData>({ queryKey })
    const prevData = query?.state.data
    const data = functionalUpdate(updater, prevData)

    if (typeof data === "undefined") {
      return undefined
    }

    const defaultedOptions = this.defaultQueryOptions<
      any,
      any,
      unknown,
      any,
      QueryKey
    >({ queryKey })

    return this.#queryCache
      .build(this, defaultedOptions)
      .setData(data, { ...options, manual: true })
  }

  getMutationDefaults(
    mutationKey: MutationKey
  ): MutationObserverOptions<any, any, any, any> {
    const defaults = [...this.#mutationDefaults.values()]

    let result: MutationObserverOptions<any, any, any, any> = {}

    defaults.forEach((queryDefault) => {
      if (compareKeys(mutationKey, queryDefault.mutationKey)) {
        result = { ...result, ...queryDefault.defaultOptions }
      }
    })

    return result
  }

  setMutationDefaults(
    mutationKey: MutationKey,
    options: Omit<MutationObserverOptions<any, any, any, any>, "mutationKey">
  ) {
    this.#mutationDefaults.set(serializeKey(mutationKey), {
      mutationKey,
      defaultOptions: options
    })
  }

  getQueryDefaults(
    queryKey: QueryKey
  ): QueryObserverOptions<any, any, any, any, any> {
    const defaults = [...this.#queryDefaults.values()]

    let result: QueryObserverOptions<any, any, any, any, any> = {}

    defaults.forEach((queryDefault) => {
      if (partialMatchKey(queryKey, queryDefault.queryKey)) {
        result = { ...result, ...queryDefault.defaultOptions }
      }
    })

    return result
  }

  async resumePausedMutations() {
    return await lastValueFrom(this.#mutationCache.resumePausedMutations())
  }

  isFetching(filters?: QueryFilters) {
    return this.#queryCache.findAll({ ...filters, fetchStatus: "fetching" })
      .length
  }

  clear(): void {
    this.#queryCache.clear()
    this.#mutationCache.clear()
  }
}