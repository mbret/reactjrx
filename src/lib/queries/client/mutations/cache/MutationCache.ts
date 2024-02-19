import { Mutation } from "../mutation/Mutation"
import { type QueryClient } from "../../QueryClient"
import { type MutationFilters } from "../types"
import {
  switchMap,
  timer,
  filter,
  take,
  merge,
  tap,
  startWith,
  combineLatest,
  EMPTY
} from "rxjs"
import { createPredicateForFilters } from "../filters"
import {
  type MutationCacheConfig,
  type MutationCacheNotifyEvent
} from "./types"
import { type MutationOptions, type MutationState } from "../mutation/types"
import { Store } from "../../store"
import { type DefaultError } from "../../types"

export class MutationCache {
  readonly #store = new Store<Mutation<any, any, any, any>>()

  constructor(public config: MutationCacheConfig = {}) {}

  build<TData, TError, TVariables, TContext>(
    client: QueryClient,
    options: MutationOptions<TData, TError, TVariables, TContext>,
    state?: MutationState<TData, TError, TVariables, TContext>
  ): Mutation<TData, TError, TVariables, TContext> {
    const mutation = new Mutation({
      mutationCache: this,
      options: client.defaultMutationOptions(options),
      state
    })

    /**
     * @important
     * unsubscribe automatically when mutation is done and gc collected
     */
    mutation.state$
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
        // defaults to 5mn
        switchMap(() => {
          return timer(mutation.options.gcTime ?? 5 * 60 * 1000)
        }),
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

    this.#store.add(mutation)

    return mutation
  }

  getAll() {
    return this.findAll()
  }

  remove(mutationToRemove: Mutation<any, any, any, any>): void {
    const toRemove = this.#store.getValues().find((mutation) => {
      return mutation === mutationToRemove
    })

    toRemove?.cancel()

    this.#store.remove(mutationToRemove)
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

    return this.#store.getValues().find((mutation) => predicate(mutation))
  }

  findAll<
    TData = unknown,
    TError = Error,
    TVariables = any,
    TContext = unknown
  >(
    filters: MutationFilters<TData, TError, TVariables, TContext> = {}
  ): Array<Mutation<any, any, any, any>> {
    const defaultedFilters = { exact: true, ...filters }

    const predicate = createPredicateForFilters(defaultedFilters)

    return this.#store
      .getValues()
      .filter((mutation) => predicate(mutation))
      .map((mutation) => mutation)
  }

  observe() {
    const value$ = this.#store.stateChange$.pipe(startWith())

    return value$
  }

  /**
   * @important
   * ISO api react-query
   */
  subscribe(listener: (event: MutationCacheNotifyEvent) => void) {
    const sub = merge(
      this.#store.added$.pipe(
        tap((mutation) => {
          listener({
            type: "added",
            mutation
          })
        })
      ),
      this.#store.removed$.pipe(
        tap((mutation) => {
          listener({
            type: "removed",
            mutation
          })
        })
      ),
      this.#store.stateChange$.pipe(
        tap((mutation) => {
          listener({
            type: "updated",
            action: {
              ...mutation.state,
              type: "success"
            },
            mutation
          })
        })
      )
    ).subscribe()

    return () => {
      sub.unsubscribe()
    }
  }

  resumePausedMutations() {
    const pausedMutations = this.findAll({
      predicate: (mutation) => mutation.state.isPaused
    })

    if (!pausedMutations.length) return EMPTY

    const mutations$ = pausedMutations.map((mutation) => mutation.continue())

    return combineLatest(mutations$)
  }

  clear() {
    this.getAll().forEach((mutation) => {
      this.remove(mutation)
    })
  }
}
