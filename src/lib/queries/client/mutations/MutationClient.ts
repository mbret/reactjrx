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
  of
} from "rxjs"
import { serializeKey } from "../keys/serializeKey"
import {
  type MutationResult,
  type MutationOptions,
  type MutationObservedResult,
  type MutationFilters,
  type MutationKey
} from "./types"
import { type QueryKey } from "../keys/types"
import { isDefined } from "../../../utils/isDefined"
import { createMutationRunner } from "./createMutationRunner"

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

  reset$ = new Subject<{ key: QueryKey }>()

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

            mutationForKey.mutationsRunning$
              .pipe(
                skip(1),
                filter((number) => number === 0)
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

    this.reset$
      .pipe(
        tap(({ key }) => {
          const serializedKey = serializeKey(key)

          this.mutationRunnersByKey$
            .getValue()
            .get(serializedKey)
            ?.reset$.next()
        })
      )
      .subscribe()
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

  /**
   * @returns number of mutation runnings
   */
  runningMutations({ mutationKey, predicate }: MutationFilters = {}) {
    const defaultPredicate: MutationFilters["predicate"] = ({ options }) =>
      mutationKey
        ? // @todo optimize
          serializeKey(options.mutationKey) === serializeKey(mutationKey)
        : true
    const finalPredicate = predicate ?? defaultPredicate

    const mutationRunnersByKeyEntries = Array.from(
      this.mutationRunnersByKey$.getValue().entries()
    )

    const lastValue = mutationRunnersByKeyEntries
      .filter(([, value]) =>
        finalPredicate({ options: { mutationKey: value.mutationKey } })
      )
      .reduce((acc, [, value]) => acc + value.mutationsRunning$.getValue(), 0)

    const value$ = this.mutationRunnersByKey$.pipe(
      switchMap((map) => {
        const mutationRunners = Array.from(map.entries())
          .filter(([, value]) =>
            finalPredicate({ options: { mutationKey: value.mutationKey } })
          )
          .map(([, value]) => value)

        // console.log("map", Array.from(map.entries()), { mutationRunners })

        const mutationRunnersMutationsRunning$ = combineLatest([
          // when map is empty we still need to push 0
          of(0),
          ...mutationRunners.map(
            (mutationRunner) => mutationRunner.mutationsRunning$
          )
        ])

        return mutationRunnersMutationsRunning$
      }),
      map((values) => values.reduce((acc, value) => value + acc, 0)),
      distinctUntilChanged()
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
   * This will reset any current mutation runnings.
   * No discrimination process
   */
  reset(params: { key: QueryKey }) {
    this.reset$.next(params)
  }

  destroy() {
    this.reset$.complete()
    this.mutate$.complete()
    this.mutationResults$.complete()
    this.mutationRunnersByKey$.complete()
  }
}
