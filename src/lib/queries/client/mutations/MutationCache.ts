import { type DefaultError } from "@tanstack/react-query"
import { Mutation } from "./Mutation"
import { type QueryClient } from "../createClient"
import {
  type MutationFilters,
  type MutationOptions,
  type MutationState
} from "./types"
import { BehaviorSubject, distinctUntilChanged, map } from "rxjs"
import { createPredicateForFilters } from "./filters"
import { shallowEqual } from "../../../utils/shallowEqual"

interface MutationCacheConfig {
  onError?: <
    Data = unknown,
    TError = DefaultError,
    TVariables = void,
    TContext = unknown
  >(
    error: DefaultError,
    variables: unknown,
    context: unknown,
    mutation: Mutation<Data, TError, TVariables, TContext>
  ) => Promise<unknown> | unknown
  onSuccess?: (
    data: unknown,
    variables: unknown,
    context: unknown,
    mutation: Mutation<unknown, unknown, unknown>
  ) => Promise<unknown> | unknown
  onMutate?: <
    Data = unknown,
    TError = DefaultError,
    TVariables = void,
    TContext = unknown
  >(
    variables: unknown,
    mutation: Mutation<Data, TError, TVariables, TContext>
  ) => Promise<TContext> | TContext
  onSettled?: (
    data: unknown | undefined,
    error: DefaultError | null,
    variables: unknown,
    context: unknown,
    mutation: Mutation<unknown, unknown, unknown>
  ) => Promise<unknown> | unknown
}

export class MutationCache {
  readonly mutations = new BehaviorSubject<Array<Mutation<any, any, any, any>>>(
    []
  )

  constructor(public config: MutationCacheConfig = {}) {}

  build<TData, TError, TVariables, TContext>(
    client: QueryClient,
    options: MutationOptions<TData, TError, TVariables, TContext>,
    state?: MutationState<TData, TError, TVariables, TContext>
  ): Mutation<TData, TError, TVariables, TContext> {
    const mutation = new Mutation({
      mutationCache: this,
      // mutationId: ++this.#mutationId,
      options: client.defaultMutationOptions(options)
      // state
    })

    this.add(mutation)

    return mutation
  }

  add(mutation: Mutation<any, any, any, any>): void {
    this.mutations.next([...this.mutations.getValue(), mutation])
  }

  getAll(): Mutation[] {
    return this.mutations.getValue()
  }

  remove(mutation: Mutation<any, any, any, any>): void {
    this.removeBy({ predicate: (item) => item === mutation })
  }

  removeBy<
    TData = unknown,
    TError = DefaultError,
    TVariables = any,
    TContext = unknown
  >(filters: MutationFilters<TData, TError, TVariables, TContext>): void {
    const defaultedFilters = { exact: true, ...filters }

    const predicate = createPredicateForFilters(defaultedFilters)

    const toKeep = this.mutations
      .getValue()
      .filter((mutation) => !predicate(mutation))

    this.mutations.next(toKeep)
  }

  find<
    TData = unknown,
    TError = DefaultError,
    TVariables = any,
    TContext = unknown
  >(
    filters: MutationFilters<TData, TError, TVariables, TContext>
  ): Mutation<TData, TError, TVariables, TContext> | undefined {
    const defaultedFilters = { exact: true, ...filters }

    const predicate = createPredicateForFilters(defaultedFilters)

    return this.mutations.getValue().find((mutation) => predicate(mutation))
  }

  /**
   * @todo optimize, should not ping if array contain same mutation in same order
   */
  mutationsBy<
    TData = unknown,
    TError = DefaultError,
    TVariables = any,
    TContext = unknown
  >(filters: MutationFilters<TData, TError, TVariables, TContext>) {
    const defaultedFilters = { exact: true, ...filters }
    const predicate = createPredicateForFilters(defaultedFilters)

    return this.mutations.pipe(
      map((mutations) => mutations.filter(predicate)),
      distinctUntilChanged((previous, current) => {
        return (
          previous.length === current.length &&
          previous.every((item, index) => item === current[index])
        )
      }),
      distinctUntilChanged(shallowEqual),
    )
  }
}
