import { type DefaultError } from "@tanstack/react-query"
import { Mutation } from "./Mutation"
import { type QueryClient } from "../createClient"
import {
  type MutationFilters,
  type MutationOptions,
  type MutationState
} from "./types"
import {
  BehaviorSubject,
  type Subscription,
  distinctUntilChanged,
  map,
  switchMap,
  timer,
  filter,
  take
} from "rxjs"
import { createPredicateForFilters } from "./filters"
import { arrayEqual } from "../../../utils/arrayEqual"

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
  onMutate?: (
    variables: unknown,
    mutation: Mutation<unknown, unknown, unknown>
  ) => Promise<unknown> | unknown
  onSettled?: (
    data: unknown | undefined,
    error: DefaultError | null,
    variables: unknown,
    context: unknown,
    mutation: Mutation<unknown, unknown, unknown>
  ) => Promise<unknown> | unknown
}

export class MutationCache {
  protected readonly mutationsSubject = new BehaviorSubject<
    Array<{ mutation: Mutation<any, any, any, any>; sub: Subscription }>
  >([])

  public mutations$ = this.mutationsSubject.pipe(
    map((mutations) => mutations.map(({ mutation }) => mutation)),
    distinctUntilChanged(arrayEqual)
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
    const sub = mutation.state$
      .pipe(
        /**
         * Once a mutation is finished and there are no more observers than us
         * we start the process of cleaning it up based on gc settings
         */
        filter(({ status }) => status === "success" || status === "error"),
        switchMap(() =>
          mutation.observerCount$.pipe(
            filter((count) => count <= 1),
            take(1)
          )
        ),
        switchMap(() => timer(mutation.options.gcTime ?? 0)),
        take(1)
      )
      .subscribe({
        complete: () => {
          /**
           * Will remove the mutation in all cases
           * - mutation cancelled (complete)
           * - mutation is finished (success /error)
           * - this subscription complete (external remove)
           */
          this.remove(mutation)
        }
      })

    this.mutationsSubject.next([
      ...this.mutationsSubject.getValue(),
      { mutation, sub }
    ])
  }

  getAll() {
    return this.findAll()
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

    const toRemove = this.mutationsSubject
      .getValue()
      .filter(({ mutation }) => {
        return predicate(mutation)
      })
      .map(({ mutation, sub }) => {
        mutation.cancel()
        sub.unsubscribe()

        return mutation
      })

    this.mutationsSubject.next(
      this.mutationsSubject
        .getValue()
        .filter(({ mutation }) => !toRemove.includes(mutation))
    )
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

    return this.mutationsSubject
      .getValue()
      .find(({ mutation }) => predicate(mutation))?.mutation
  }

  findLatest<
    TData = unknown,
    TError = DefaultError,
    TVariables = any,
    TContext = unknown
  >(
    filters: MutationFilters<TData, TError, TVariables, TContext>
  ): Mutation<TData, TError, TVariables, TContext> | undefined {
    const defaultedFilters = { exact: true, ...filters }

    const predicate = createPredicateForFilters(defaultedFilters)

    return this.mutationsSubject
      .getValue()
      .slice()
      .reverse()
      .find(({ mutation }) => predicate(mutation))?.mutation
  }

  findAll(filters: MutationFilters = {}): Array<Mutation<any, any, any, any>> {
    const defaultedFilters = { exact: true, ...filters }

    const predicate = createPredicateForFilters(defaultedFilters)

    return this.mutationsSubject
      .getValue()
      .filter(({ mutation }) => predicate(mutation))
      .map(({ mutation }) => mutation)
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

    return this.mutations$.pipe(
      map((mutations) => mutations.filter(predicate)),
      distinctUntilChanged(arrayEqual)
    )
  }
}
