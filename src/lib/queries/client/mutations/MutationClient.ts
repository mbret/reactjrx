/* eslint-disable @typescript-eslint/naming-convention */
import {
  Subject,
  switchMap,
  BehaviorSubject,
  filter,
  EMPTY,
  skip,
  tap,
  map,
  type Observable,
  combineLatest,
  distinctUntilChanged,
  startWith,
  of
} from "rxjs"
import { serializeKey } from "../keys/serializeKey"
import {
  type MutationResult,
  type MutationOptions,
  type MutationObservedResult,
  type MutationFilters,
  type MutationKey,
  type MutationState
} from "./types"
import { type QueryKey } from "../keys/types"
import { isDefined } from "../../../utils/isDefined"
import { createMutationRunner } from "./createMutationRunner"
import { createPredicateForFilters } from "./filters"
import { shallowEqual } from "../../../utils/shallowEqual"
import { type Mutation } from "./Mutation"

export class MutationClient {
  /**
   * Contain all active mutation for a given key.
   * A mutation ca have several triggers running (it is not necessarily one function running)
   *
   * @important
   * - automatically cleaned as soon as the last mutation is done for a given key
   */
  mutationRunnersByKey$ = new BehaviorSubject<
    Map<
      string,
      ReturnType<typeof createMutationRunner> & {
        mutationKey: MutationKey
      }
    >
  >(new Map())

  /**
   * Mutation result subject. It can be used whether there is a mutation
   * running or not and can be directly observed.
   *
   * @important
   * - automatically cleaned as soon as the last mutation is done for a given key
   */
  mutationResults$ = new BehaviorSubject<
    Map<string, BehaviorSubject<MutationResult<any>>>
  >(new Map())

  mutate$ = new Subject<{
    options: MutationOptions<any, any>
    args: any
  }>()

  cancel$ = new Subject<{ key: QueryKey }>()

  /**
   * Observable to track how many running mutations per runner
   */
  isMutatingSubject = new BehaviorSubject<
    Array<readonly [MutationKey, number]>
  >([])

  /**
   * List of all mutations running
   */
  mutationsSubject = new BehaviorSubject<Array<Mutation<any>>>([])

  constructor() {
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
              ...createMutationRunner(options),
              mutationKey
            }

            this.setMutationRunnersByKey(serializedMutationKey, mutationForKey)

            mutationForKey.mutation$.subscribe((result) => {
              let resultForKeySubject = this.mutationResults$
                .getValue()
                .get(serializedMutationKey)

              if (!resultForKeySubject) {
                resultForKeySubject = new BehaviorSubject(result)

                // @todo can be wrapped in function
                const resultMap = this.mutationResults$.getValue()

                resultMap.set(serializedMutationKey, resultForKeySubject)

                this.mutationResults$.next(resultMap)
              } else {
                resultForKeySubject?.next(result)
              }
            })

            mutationForKey.mutationsSubject
              .pipe(
                distinctUntilChanged(shallowEqual),
                skip(1),
                filter((items) => items.length === 0)
              )
              .subscribe(() => {
                mutationForKey?.destroy()

                // @todo can be wrapped in function
                const resultMap = this.mutationResults$.getValue()
                resultMap.delete(serializedMutationKey)
                this.mutationResults$.next(resultMap)

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

    /**
     * @optimize
     */
    this.mutationRunnersByKey$
      .pipe(
        switchMap((mapItem) => {
          const mutationRunners = Array.from(mapItem.values())

          const mutations$ = combineLatest(
            mutationRunners.map((runner) =>
              runner.mutationsSubject.pipe(
                map((mutations) => mutations.map((mutation) => mutation))
              )
            )
          )

          return mutations$.pipe(
            map((mutationsByKeys) =>
              mutationsByKeys.reduce((acc, value) => [...acc, ...value], [])
            )
          )
        }),
        startWith([]),
        distinctUntilChanged(shallowEqual)
      )
      .subscribe(this.mutationsSubject)
  }

  /**
   * @helper
   */
  setMutationRunnersByKey(key: string, value: any) {
    const map = this.mutationRunnersByKey$.getValue()

    map.set(key, value)

    this.mutationRunnersByKey$.next(map)
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

  useIsMutating<TData>(filters: MutationFilters<TData> = {}) {
    const predicate = createPredicateForFilters(filters)

    const reduceByNumber = (entries: Array<Mutation<any>>) =>
      entries.reduce((acc: number, mutation) => {
        return predicate(mutation) &&
          mutation.stateSubject.getValue().status === "pending"
          ? 1 + acc
          : acc
      }, 0)

    const lastValue = reduceByNumber(this.mutationsSubject.getValue())

    const value$ = this.mutationsSubject.pipe(
      switchMap((mutations) => {
        const mutationsOnStateUpdate = mutations.map((mutation) =>
          mutation.stateSubject.pipe(map(() => mutation))
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
    const finalSelect =
      select ?? ((mutation) => mutation.stateSubject.getValue() as Selected)

    const lastValue = this.mutationsSubject
      .getValue()
      .reduce((acc: Array<Mutation<any>>, mutation) => {
        const result = [...acc, mutation]

        return result
      }, [])
      .filter(predicate)
      .map((mutation) => finalSelect(mutation))

    const value$ = this.mutationsSubject.pipe(
      switchMap((mutations) => {
        const mutationsOnStateUpdate = mutations.map((mutation) =>
          mutation.stateSubject.pipe(
            filter(() => predicate(mutation)),
            map(() => finalSelect(mutation))
          )
        )

        return mutationsOnStateUpdate.length === 0
          ? of([])
          : combineLatest(mutationsOnStateUpdate)
      }),
      distinctUntilChanged(shallowEqual)
    )

    return { value$, lastValue }
  }

  observe<Result>({ key }: { key: string }): {
    result$: Observable<MutationObservedResult<Result>>
    lastValue: MutationObservedResult<Result>
  } {
    const currentResultValue = this.mutationResults$
      .getValue()
      .get(key)
      ?.getValue()

    const mapResultToObservedResult = (value: MutationResult<Result>) => ({
      ...value,
      isIdle: value.status === "idle",
      isPaused: false,
      isError: value.error !== undefined,
      isPending: false,
      isSuccess: value.status === "success"
    })

    const lastValue = currentResultValue
      ? mapResultToObservedResult(currentResultValue)
      : mapResultToObservedResult({
          data: undefined,
          error: undefined,
          status: "idle"
        })

    const result$ = this.mutationResults$
      .pipe(
        switchMap((resultMap) => {
          const subject = resultMap.get(key)

          return subject ?? EMPTY
        })
      )
      .pipe(
        filter(isDefined),
        map((value) => ({
          ...value,
          isIdle: value.status === "idle",
          isPaused: false,
          isError: value.error !== undefined,
          isPending: false,
          isSuccess: value.status === "success"
        }))
      )

    return { result$, lastValue }
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
    this.cancel$.complete()
    this.mutate$.complete()
    this.mutationResults$.complete()
    this.mutationRunnersByKey$.complete()
    this.isMutatingSubject.complete()
    this.mutationsSubject.complete()
  }
}
