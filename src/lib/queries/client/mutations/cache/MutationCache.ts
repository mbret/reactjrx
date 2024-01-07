import { type DefaultError } from "@tanstack/react-query"
import { Mutation } from "../mutation/Mutation"
import { type QueryClient } from "../../createClient"
import {
  type MutationFilters,
  type MutationOptions,
  type MutationState
} from "../types"
import {
  BehaviorSubject,
  type Subscription,
  distinctUntilChanged,
  map,
  switchMap,
  timer,
  filter,
  take,
  share,
  pairwise,
  merge,
  tap,
  mergeMap,
  from,
  takeUntil,
  startWith,
  combineLatest,
  EMPTY
} from "rxjs"
import { createPredicateForFilters } from "../filters"
import { arrayEqual } from "../../../../utils/arrayEqual"
import { type MutationCacheNotifyEvent } from "./types"
import { isDefined } from "../../../../utils/isDefined"
import { shallowEqual } from "../../../../utils/shallowEqual"

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
    distinctUntilChanged(arrayEqual),
    share()
  )

  public added$ = this.mutations$.pipe(
    pairwise(),
    map(
      ([previous, current]) =>
        current.filter((mutation) => !previous.includes(mutation))[0]
    ),
    filter(isDefined),
    share()
  )

  public removed$ = this.mutations$.pipe(
    pairwise(),
    map(([previous, current]) =>
      previous.filter((mutation) => !current.includes(mutation))
    ),
    mergeMap((removedItems) => from(removedItems)),
    share()
  )

  public stateChange$ = this.added$.pipe(
    mergeMap((mutation) =>
      mutation.state$.pipe(
        map(() => mutation),
        takeUntil(
          this.removed$.pipe(
            filter((removedMutation) => removedMutation === mutation)
          )
        )
      )
    ),
    share()
  )

  constructor(public config: MutationCacheConfig = {}) {}

  subscribe(listener: (event: MutationCacheNotifyEvent) => void) {
    const sub = merge(
      this.added$.pipe(
        tap((mutation) => {
          listener({
            type: "added",
            mutation
          })
        })
      ),
      this.removed$.pipe(
        tap((mutation) => {
          listener({
            type: "removed",
            mutation
          })
        })
      ),
      this.stateChange$.pipe(
        tap((mutation) => {
          listener({
            type: "updated",
            action: {
              ...mutation.state,
              // @todo
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
        // defaults to 5mn
        switchMap(() => {
          console.log("START GC")

          return timer(mutation.options.gcTime ?? 5 * 60 * 1000)
        }),
        take(1)
      )
      .subscribe({
        complete: () => {
          console.log("COMPLETED")
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

    return mutation
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
        mutation.destroy()
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

  observeMutationsBy<
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

  mutationStateBy<TData, MutationStateSelected = MutationState<TData>>({
    filters,
    select
  }: {
    filters?: MutationFilters<TData>
    select?: (mutation: Mutation<TData>) => MutationStateSelected
  } = {}) {
    const predicate = createPredicateForFilters(filters)
    const finalSelect =
      select ?? ((mutation) => mutation.state as MutationStateSelected)

    const lastValue = this.getAll()
      .reduce((acc: Array<Mutation<any>>, mutation) => {
        const result = [...acc, mutation]

        return result
      }, [])
      .filter(predicate)
      .map((mutation) => finalSelect(mutation))

    const value$ = this.stateChange$.pipe(
      startWith(),
      map(() => {
        const filteredMutations = this.getAll().filter(predicate)

        return filteredMutations.map(finalSelect)
      }),
      distinctUntilChanged(shallowEqual)
    )

    return { value$, lastValue }
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
