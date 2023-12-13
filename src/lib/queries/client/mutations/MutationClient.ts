/* eslint-disable @typescript-eslint/naming-convention */
import {
  Subject,
  switchMap,
  BehaviorSubject,
  filter,
  skip,
  tap,
  map,
  combineLatest,
  distinctUntilChanged,
  of,
  take
} from "rxjs"
import { serializeKey } from "../keys/serializeKey"
import {
  type MutationOptions,
  type MutationFilters,
  type MutationKey,
  type MutationState
} from "./types"
import { type QueryKey } from "../keys/types"
import { createMutationRunner } from "./createMutationRunner"
import { createPredicateForFilters } from "./filters"
import { shallowEqual } from "../../../utils/shallowEqual"
import { type Mutation } from "./Mutation"
import { type QueryClient } from "../createClient"

export class MutationClient {
  /**
   * Contain all active mutation for a given key.
   * A mutation ca have several triggers running (it is not necessarily one function running)
   *
   * @important
   * - automatically cleaned as soon as the last mutation is done for a given key
   */
  mutationRunnersByKey$ = new BehaviorSubject<
    Map<string, ReturnType<typeof createMutationRunner<any, any, any, any>>>
  >(new Map())

  mutationRunner$ = new Subject<ReturnType<typeof createMutationRunner>>()

  mutate$ = new Subject<{
    options: MutationOptions<any, any, any, any>
    args: any
  }>()

  cancel$ = new Subject<{ key: QueryKey }>()

  /**
   * Observable to track how many running mutations per runner
   */
  isMutatingSubject = new BehaviorSubject<
    Array<readonly [MutationKey, number]>
  >([])

  constructor(public client: QueryClient) {
    this.mutate$
      .pipe(
        tap(({ options, args }) => {
          const { mutationKey } = options
          const serializedMutationKey = serializeKey(mutationKey)

          let mutationForKey = this.getMutationRunnersByKey(
            serializedMutationKey
          )

          if (!mutationForKey) {
            mutationForKey = {
              ...createMutationRunner({
                ...options,
                client,
                mutationCache: client.getMutationCache()
              }),
              mutationKey
            }

            this.setMutationRunnersByKey(serializedMutationKey, mutationForKey)

            // @todo change and verify if we unsubscribe
            mutationForKey.runner$.subscribe()

            /**
             * @important
             * should have at least one first mutation so
             * should unsubscribe by itself once filter back to 0 run
             */
            client.mutationCache
              .mutationsBy({
                exact: true,
                mutationKey
              })
              .pipe(
                distinctUntilChanged(shallowEqual),
                skip(1),
                filter((items) => items.length === 0),
                take(1)
              )
              .subscribe(() => {
                mutationForKey?.destroy()

                this.deleteMutationRunnersByKey(serializedMutationKey)
              })
          }

          mutationForKey.trigger({ args, options })
        })
      )
      .subscribe()

    this.cancel$
      .pipe(
        tap(({ key }) => {
          const serializedKey = serializeKey(key)

          this.mutationRunnersByKey$
            .getValue()
            .get(serializedKey)
            ?.cancel$.next()
        })
      )
      .subscribe()
  }

  /**
   * @helper
   */
  setMutationRunnersByKey(
    key: string,
    value: ReturnType<typeof createMutationRunner>
  ) {
    const map = this.mutationRunnersByKey$.getValue()

    map.set(key, value)

    this.mutationRunnersByKey$.next(map)

    this.mutationRunner$.next(value)
  }

  /**
   * @helper
   */
  deleteMutationRunnersByKey(key: string) {
    const map = this.mutationRunnersByKey$.getValue()

    map.delete(key)

    this.mutationRunnersByKey$.next(map)
  }

  /**
   * @helper
   */
  getMutationRunnersByKey(key: string) {
    return this.mutationRunnersByKey$.getValue().get(key)
  }

  isMutating<TData>(filters: MutationFilters<TData> = {}) {
    const predicate = createPredicateForFilters(filters)

    const reduceByNumber = (entries: Array<Mutation<any>>) =>
      entries.reduce((acc: number, mutation) => {
        return predicate(mutation) && mutation.state.status === "pending"
          ? 1 + acc
          : acc
      }, 0)

    const lastValue = reduceByNumber(this.client.mutationCache.getAll())

    const value$ = this.client.mutationCache.mutationsBy(filters).pipe(
      switchMap((mutations) => {
        const mutationsOnStateUpdate = mutations.map((mutation) =>
          mutation.state$.pipe(map(() => mutation))
        )

        return mutationsOnStateUpdate.length === 0
          ? of([])
          : combineLatest(mutationsOnStateUpdate)
      }),
      map(reduceByNumber),
      distinctUntilChanged()
    )

    return { value$, lastValue }
  }

  mutationState<TData, Selected = MutationState<TData>>({
    filters,
    select
  }: {
    filters?: MutationFilters<TData>
    select?: (mutation: Mutation<TData>) => Selected
  } = {}) {
    const predicate = createPredicateForFilters(filters)
    const finalSelect = select ?? ((mutation) => mutation.state as Selected)

    const lastValue = this.client.mutationCache.getAll()
      .reduce((acc: Array<Mutation<any>>, mutation) => {
        const result = [...acc, mutation]

        return result
      }, [])
      .filter(predicate)
      .map((mutation) => finalSelect(mutation))

    const value$ = this.client.mutationCache.mutations$.pipe(
      switchMap((mutations) => {
        const mutationsOnStateUpdate = mutations.map((mutation) =>
          mutation.state$.pipe(map(() => mutation))
        )

        return mutationsOnStateUpdate.length === 0
          ? of([])
          : combineLatest(mutationsOnStateUpdate)
      }),
      map((mutations) => mutations.filter(predicate).map(finalSelect)),
      distinctUntilChanged(shallowEqual)
    )

    return { value$, lastValue }
  }

  mutate<Result, MutationArgs>(params: {
    options: MutationOptions<Result, MutationArgs>
    args: MutationArgs
  }) {
    this.mutate$.next(params)
  }

  /**
   * This will cancel any current mutation runnings.
   * No discrimination process
   */
  cancel(params: { key: QueryKey }) {
    this.cancel$.next(params)
  }

  destroy() {
    this.mutationRunner$.complete()
    this.cancel$.complete()
    this.mutate$.complete()
    this.mutationRunnersByKey$.complete()
    this.isMutatingSubject.complete()
  }
}
