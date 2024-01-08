import { type DefaultError } from "@tanstack/react-query"
import { Mutation } from "../mutation/Mutation"
import { type QueryClient } from "../../createClient"
import { type MutationFilters } from "../types"
import {
  BehaviorSubject,
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
import {
  type MutationCacheConfig,
  type MutationCacheNotifyEvent
} from "./types"
import { isDefined } from "../../../../utils/isDefined"
import { shallowEqual } from "../../../../utils/shallowEqual"
import { type MutationOptions, type MutationState } from "../mutation/types"

export class MutationCache {
  protected readonly mutationsSubject = new BehaviorSubject<
    Array<Mutation<any, any, any, any>>
  >([])

  protected mutations$ = this.mutationsSubject.pipe(
    map((mutations) => mutations.map((mutation) => mutation)),
    distinctUntilChanged(arrayEqual),
    share()
  )

  protected added$ = this.mutations$.pipe(
    pairwise(),
    map(
      ([previous, current]) =>
        current.filter((mutation) => !previous.includes(mutation))[0]
    ),
    filter(isDefined),
    share()
  )

  protected removed$ = this.mutations$.pipe(
    pairwise(),
    map(([previous, current]) =>
      previous.filter((mutation) => !current.includes(mutation))
    ),
    mergeMap((removedItems) => from(removedItems)),
    share()
  )

  protected stateChange$ = this.added$.pipe(
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
          this.mutationsSubject.next(
            this.mutationsSubject
              .getValue()
              .filter((toRemove) => mutation !== toRemove)
          )
        }
      })

    this.mutationsSubject.next([...this.mutationsSubject.getValue(), mutation])

    return mutation
  }

  getAll() {
    return this.findAll()
  }

  remove(mutationToRemove: Mutation<any, any, any, any>): void {
    const toRemove = this.mutationsSubject.getValue().find((mutation) => {
      return mutation === mutationToRemove
    })

    toRemove?.destroy()
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
      .find((mutation) => predicate(mutation))
  }

  findAll(filters: MutationFilters = {}): Array<Mutation<any, any, any, any>> {
    const defaultedFilters = { exact: true, ...filters }

    const predicate = createPredicateForFilters(defaultedFilters)

    return this.mutationsSubject
      .getValue()
      .filter((mutation) => predicate(mutation))
      .map((mutation) => mutation)
  }

  observe<TData, MutationStateSelected = MutationState<TData>>({
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

  /**
   * @important
   * ISO api react-query
   */
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
