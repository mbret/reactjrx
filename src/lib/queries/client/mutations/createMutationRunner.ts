/* eslint-disable @typescript-eslint/naming-convention */
import {
  BehaviorSubject,
  Subject,
  combineLatest,
  concatMap,
  distinctUntilChanged,
  filter,
  finalize,
  identity,
  map,
  mergeMap,
  skip,
  startWith,
  switchMap,
  take,
  takeUntil,
} from "rxjs"
import { isDefined } from "../../../utils/isDefined"
import { type MutationOptions } from "./types"
import { mergeResults } from "./operators"
import { createMutation } from "./createMutation"

export type MutationRunner = ReturnType<typeof createMutationRunner>

export const createMutationRunner = <T, MutationArg>({
  __queryFinalizeHook,
  __queryInitHook,
  __queryTriggerHook
}: Pick<
  MutationOptions<any, any>,
  "__queryInitHook" | "__queryTriggerHook" | "__queryFinalizeHook"
>) => {
  const trigger$ = new Subject<{
    args: MutationArg
    options: MutationOptions<T, MutationArg>
  }>()
  const reset$ = new Subject<void>()
  let closed = false
  const mapOperator$ = new BehaviorSubject<
    MutationOptions<any, any>["mapOperator"]
  >("merge")
  const mutationsSubject = new BehaviorSubject<
    Array<ReturnType<typeof createMutation>>
  >([])

  /**
   * Mutation can be destroyed in two ways
   * - caller unsubscribe to the mutation
   * - caller call destroy directly
   */
  const destroy = () => {
    if (closed) {
      throw new Error("Trying to close an already closed mutation")
    }

    closed = true

    mapOperator$.complete()
    mutationsSubject.complete()
    trigger$.complete()
    reset$.complete()
  }

  const stableMapOperator$ = mapOperator$.pipe(
    filter(isDefined),
    distinctUntilChanged()
  )

  const mutation$ = stableMapOperator$.pipe(
    (__queryInitHook as typeof identity) ?? identity,
    mergeMap((mapOperator) => {
      const switchOperator =
        mapOperator === "concat"
          ? concatMap
          : mapOperator === "switch"
            ? switchMap
            : mergeMap

      return trigger$.pipe(
        takeUntil(stableMapOperator$.pipe(skip(1))),
        switchOperator(({ args, options }) => {
          const mutation = createMutation({
            args,
            ...options,
            mapOperator
          })

          mutationsSubject.next([...mutationsSubject.getValue(), mutation])

          const queryIsOver$ = mutation.mutation$.pipe(
            map(({ data, error }) => error || data)
          )

          const isThisCurrentFunctionLastOneCalled = trigger$.pipe(
            take(1),
            map(() => options.mapOperator === "concat"),
            startWith(true),
            takeUntil(queryIsOver$)
          )

          return combineLatest([
            mutation.mutation$,
            isThisCurrentFunctionLastOneCalled
          ]).pipe(
            map(([result, isLastMutationCalled]) => {
              if (
                (result.status === "success" || result.status === "error") &&
                !isLastMutationCalled
              ) {
                return {}
              }

              return result
            }),
            takeUntil(reset$),
            finalize(() => {
              mutationsSubject.next(
                mutationsSubject.getValue().filter((item) => item !== mutation)
              )
            })
          )
        }),
        (__queryTriggerHook as typeof identity) ?? identity,
        mergeResults
      )
    }),
    (__queryFinalizeHook as typeof identity) ?? identity
  )

  return {
    mutation$,
    trigger: ({
      args,
      options
    }: {
      args: MutationArg
      options: MutationOptions<T, MutationArg>
    }) => {
      mapOperator$.next(options.mapOperator)
      trigger$.next({ args, options })
    },
    reset$,
    destroy,
    mutationsSubject,
    getClosed: () => closed
  }
}
