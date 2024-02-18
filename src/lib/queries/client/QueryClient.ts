import { lastValueFrom, noop } from "rxjs"
import { type MutationKey } from "./mutations/types"
import { MutationCache } from "./mutations/cache/MutationCache"
import { type MutationObserverOptions } from "./mutations/observers/types"
import { matchKey } from "./keys/matchKey"
import { type MutationOptions } from "./mutations/mutation/types"
import { QueryCache } from "./queries/cache/QueryCache"
import {
  type DataTag,
  type Updater,
  type FetchQueryOptions,
  type QueryFilters,
  type SetDataOptions,
  type RefetchOptions,
  type QueryOptions
} from "./queries/types"
import {
  type RefetchQueryFilters,
  type DefaultError,
  type InvalidateOptions,
  type InvalidateQueryFilters,
  type ResetOptions
} from "./types"
import { type QueryKey } from "./keys/types"
import {
  type DefaultedQueryObserverOptions,
  type QueryObserverOptions
} from "./queries/observer/types"
import { functionalUpdate, hashQueryKeyByOptions } from "./queries/utils"
import { type NoInfer } from "../../utils/types"
import { type QueryState } from "./queries/query/types"
import { type CancelOptions } from "./queries/retryer/types"
import { hashKey } from "./keys/hashKey"
import { partialMatchKey } from "./keys/partialMatchKey"

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

  // #destroy = () => {}

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
    // this.#destroy = this.#queryCache.client.start()
  }

  unmount() {
    // this.#destroy()
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
        defaultedOptions as QueryOptions<any, any, any, any, never>
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

  async resetQueries(
    filters?: QueryFilters,
    options?: ResetOptions
  ): Promise<void> {
    const queryCache = this.#queryCache

    const refetchFilters: RefetchQueryFilters = {
      type: "active",
      ...filters
    }

    queryCache.findAll(filters).forEach((query) => {
      query.reset()
    })

    await this.refetchQueries(refetchFilters, options)
  }

  async refetchQueries(
    filters: RefetchQueryFilters = {},
    options?: RefetchOptions
  ): Promise<void> {
    const fetchOptions = {
      ...options,
      cancelRefetch: options?.cancelRefetch ?? true
    }

    console.log("QueryClient.refetchQueries", { fetchOptions })

    const promises = this.#queryCache
      .findAll(filters)
      .filter((query) => !query.isDisabled())
      .map(async (query) => {
        let promise = query.fetch(undefined, fetchOptions)
        if (!fetchOptions.throwOnError) {
          promise = promise.catch(noop)
        }

        return query.state.fetchStatus === "paused" ? undefined : await promise
      })

    await Promise.all(promises).then(noop)
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
      if (matchKey(mutationKey, queryDefault.mutationKey)) {
        result = { ...result, ...queryDefault.defaultOptions }
      }
    })

    return result
  }

  getQueryState<TQueryFnData = unknown, TError = DefaultError>(
    queryKey: QueryKey
  ): QueryState<TQueryFnData, TError> | undefined {
    return this.#queryCache.find<TQueryFnData, TError>({ queryKey })?.state
  }

  setMutationDefaults(
    mutationKey: MutationKey,
    options: Omit<MutationObserverOptions<any, any, any, any>, "mutationKey">
  ) {
    this.#mutationDefaults.set(hashKey(mutationKey), {
      mutationKey,
      defaultOptions: options
    })
  }

  setQueryDefaults(
    queryKey: QueryKey,
    options: Partial<
      Omit<QueryObserverOptions<unknown, any, any, any>, "queryKey">
    >
  ): void {
    this.#queryDefaults.set(hashKey(queryKey), {
      queryKey,
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

  removeQueries(filters?: QueryFilters): void {
    const queryCache = this.#queryCache

    queryCache.findAll(filters).forEach((query) => {
      queryCache.remove(query)
    })
  }

  async cancelQueries(
    filters: QueryFilters = {},
    cancelOptions: CancelOptions = {}
  ): Promise<void> {
    const defaultedCancelOptions = { revert: true, ...cancelOptions }

    const promises = this.#queryCache.findAll(filters).map(async (query) => {
      await query.cancel(defaultedCancelOptions)
    })

    await Promise.all(promises).then(noop).catch(noop)
  }

  async invalidateQueries(
    filters: InvalidateQueryFilters = {},
    options: InvalidateOptions = {}
  ): Promise<void> {
    console.log("QueryClient.invalidateQueries")
    this.#queryCache.findAll(filters).forEach((query) => {
      query.invalidate()
    })

    if (filters.refetchType === "none") {
      await Promise.resolve()
      return
    }

    const refetchFilters: RefetchQueryFilters = {
      ...filters,
      type: filters.refetchType ?? filters.type ?? "active"
    }

    await this.refetchQueries(refetchFilters, options)
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
