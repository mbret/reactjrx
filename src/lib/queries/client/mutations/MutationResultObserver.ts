import {
  BehaviorSubject,
  EMPTY,
  type Observable,
  filter,
  finalize,
  merge,
  switchMap,
  tap
} from "rxjs"
import {
  type MutationKey,
  type MutationObserverResult,
  type MutationState
} from "./types"
import { type DefaultError } from "../types"
import { type createMutationRunner } from "./createMutationRunner"
import { serializeKey } from "../keys/serializeKey"
import { isDefined } from "../../../utils/isDefined"
import { getDefaultMutationState } from "./defaultMutationState"

export class MutationResultObserver {
  /**
   * Mutation result subject. It can be used whether there is a mutation
   * running or not and can be directly observed.
   *
   * @important
   * - automatically cleaned as soon as the last mutation is done for a given key
   */
  mutationResults$ = new BehaviorSubject<
    Map<string, BehaviorSubject<MutationObserverResult>>
  >(new Map())

  constructor(
    mutationRunnersByKey$: BehaviorSubject<
      Map<
        string,
        ReturnType<typeof createMutationRunner> & {
          mutationKey: MutationKey
        }
      >
    >
  ) {
    /**
     * @important
     * - should complete on subject complete
     */
    mutationRunnersByKey$
      .pipe(
        switchMap((mapItem) => {
          const runners = Array.from(mapItem.values()).map((runner) => {
            const serializedMutationKey = serializeKey(runner.mutationKey)

            return runner.mutation$.pipe(
              tap((result) => {
                this.updateResultForKey({
                  serializedMutationKey,
                  result
                })
              }),
              finalize(() => {
                this.deleteResultForKey({ serializedMutationKey })
              })
            )
          })

          return merge(...runners)
        })
      )
      .subscribe()
  }

  getDefaultResultValue<TData>(): MutationObserverResult<TData> {
    return {
      ...getDefaultMutationState(),
      isSuccess: false,
      isPending: false,
      isIdle: true,
      isError: false
    }
  }

  deleteResultForKey({
    serializedMutationKey
  }: {
    serializedMutationKey: string
  }) {
    const resultMap = this.mutationResults$.getValue()
    resultMap.delete(serializedMutationKey)
    this.mutationResults$.next(resultMap)
  }

  updateResultForKey<TData, TError = DefaultError>({
    serializedMutationKey,
    result
  }: {
    serializedMutationKey: string
    result: MutationState<TData, TError>
  }) {
    const resultForKeySubject = this.mutationResults$
      .getValue()
      .get(serializedMutationKey)

    const valueForResult: MutationObserverResult<TData, TError> = {
      ...this.getDefaultResultValue(),
      ...result,
      isSuccess: result.status === "success",
      isPending: result.status === "pending",
      isIdle: result.status === "idle",
      isError: result.status === "error"
    }

    if (!resultForKeySubject) {
      const resultMap = this.mutationResults$.getValue()

      resultMap.set(
        serializedMutationKey,
        new BehaviorSubject<MutationObserverResult>(valueForResult)
      )

      this.mutationResults$.next(resultMap)
    } else {
      resultForKeySubject?.next(valueForResult)
    }
  }

  observe<Result>({ key }: { key: string }): {
    result$: Observable<MutationObserverResult<Result>>
    lastValue: MutationObserverResult<Result>
  } {
    const currentResultValue = this.mutationResults$
      .getValue()
      .get(key)
      ?.getValue() as MutationObserverResult<Result>

    const lastValue = currentResultValue ?? this.getDefaultResultValue<Result>()

    const result$ = this.mutationResults$
      .pipe(
        switchMap((resultMap) => {
          const subject = resultMap.get(key)

          return subject ?? EMPTY
        })
      )
      .pipe(filter(isDefined)) as Observable<MutationObserverResult<Result>>

    return { result$, lastValue }
  }

  destroy() {
    this.mutationResults$.complete()
  }
}
