import {
  BehaviorSubject,
  type Observable,
  filter,
  switchMap,
  tap,
  type Subject,
  mergeMap,
  takeUntil,
  finalize,
  map,
  distinctUntilChanged
} from "rxjs"
import {
  type MutationKey,
  type MutationObserverResult,
  type MutationState
} from "./types"
import { type createMutationRunner } from "./createMutationRunner"
import { serializeKey } from "../keys/serializeKey"
import { isDefined } from "../../../utils/isDefined"
import { getDefaultMutationState } from "./defaultMutationState"

/**
 * Provide API to observe mutations results globally.
 * Observe runners and map their results in a hash map.
 */
export class MutationObserver {
  /**
   * Mutation result subject. It can be used whether there is a mutation
   * running or not and can be directly observed.
   *
   * @important
   * - automatically cleaned as soon as the last mutation is done for a given key
   */
  mutationResults$ = new BehaviorSubject<
    Record<string, BehaviorSubject<MutationObserverResult>>
  >({})

  constructor(
    mutationRunner$: Subject<
      ReturnType<typeof createMutationRunner<any, any, any, any>> & {
        mutationKey: MutationKey
      }
    >
  ) {
    mutationRunner$
      .pipe(
        mergeMap((runner) => {
          const serializedMutationKey = serializeKey(runner.mutationKey)

          return runner.runner$.pipe(
            tap((result) => {
              this.updateResultForKey({
                serializedMutationKey,
                result
              })
            }),
            takeUntil(
              mutationRunner$.pipe(
                filter(
                  (runner) =>
                    serializeKey(runner.mutationKey) === serializedMutationKey
                )
              )
            ),
            finalize(() => {
              this.deleteResultForKey({ serializedMutationKey })
            })
          )
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
    const { [serializedMutationKey]: deleted, ...rest } =
      this.mutationResults$.getValue()

    this.mutationResults$.next(rest)
  }

  updateResultForKey({
    serializedMutationKey,
    result
  }: {
    serializedMutationKey: string
    result: MutationState<any, any, any, any>
  }) {
    const resultForKeySubject =
      this.mutationResults$.getValue()[serializedMutationKey]

    const valueForResult: MutationObserverResult = {
      ...this.getDefaultResultValue(),
      ...result,
      isSuccess: result.status === "success",
      isPending: result.status === "pending",
      isIdle: result.status === "idle",
      isError: result.status === "error"
    }

    if (!resultForKeySubject) {
      const resultMap = this.mutationResults$.getValue()

      this.mutationResults$.next({
        ...resultMap,
        [serializedMutationKey]: new BehaviorSubject<MutationObserverResult>(
          valueForResult
        )
      })
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
      [key]?.getValue() as MutationObserverResult<Result>

    const lastValue = currentResultValue ?? this.getDefaultResultValue<Result>()

    const result$ = this.mutationResults$.pipe(
      map((resultMap) => resultMap[key]),
      filter(isDefined),
      distinctUntilChanged(),
      switchMap((resultObserver) => resultObserver)
    ) as Observable<MutationObserverResult<Result>>

    return { result$, lastValue }
  }

  destroy() {
    this.mutationResults$.complete()
  }
}
