import { lastValueFrom } from "rxjs"
import { serializeKey } from "./keys/serializeKey"
import { type MutationKey } from "./mutations/types"
import { MutationCache } from "./mutations/cache/MutationCache"
import { type MutationObserverOptions } from "./mutations/observers/types"
import { compareKeys } from "./keys/compareKeys"
import { type MutationOptions } from "./mutations/mutation/types"
import { QueryCache } from "./queries/cache/QueryCache"
import { type QueryFilters } from "./queries/types"

export class QueryClient {
  readonly #mutationCache: MutationCache
  readonly #queryCache: QueryCache
  readonly #mutationDefaults = new Map()

  #destroy = () => {}

  constructor({
    mutationCache,
    queryCache
  }: {
    mutationCache?: MutationCache
    queryCache?: QueryCache
  } = {}) {
    this.#mutationCache = mutationCache ?? new MutationCache()
    this.#queryCache = queryCache ?? new QueryCache()
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
