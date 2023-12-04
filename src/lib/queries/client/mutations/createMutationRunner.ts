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
  of,
  shareReplay,
  skip,
  startWith,
  switchMap,
  take,
  takeUntil
} from "rxjs"
import { isDefined } from "../../../utils/isDefined"
import { type MutationOptions } from "./types"
import { mergeResults } from "./operators"
import { Mutation } from "./Mutation"

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
  const cancel$ = new Subject<void>()
  let closed = false
  const mapOperator$ = new BehaviorSubject<
    MutationOptions<any, any>["mapOperator"]
  >("merge")
  const mutationsSubject = new BehaviorSubject<Array<Mutation<any>>>([])

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
    /**
     * make sure we cancel ongoing requests if we destroy this runner before they finish
     */
    cancel$.next()
    cancel$.complete()
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

      let mutationsForCurrentMapOperatorSubject: Array<Mutation<any>> = []

      const removeMutation = (mutation: Mutation<any>) => {
        mutationsForCurrentMapOperatorSubject =
          mutationsForCurrentMapOperatorSubject.filter(
            (item) => item !== mutation
          )
        mutationsSubject.next(
          mutationsSubject.getValue().filter((item) => item !== mutation)
        )
      }

      return trigger$.pipe(
        takeUntil(stableMapOperator$.pipe(skip(1))),
        map(({ args, options }) => {
          const mutation = new Mutation({
            args,
            ...options,
            mapOperator
          })

          mutationsForCurrentMapOperatorSubject = [
            ...mutationsForCurrentMapOperatorSubject,
            mutation
          ]

          mutationsSubject.next([...mutationsSubject.getValue(), mutation])

          return mutation
        }),
        switchOperator((mutation) => {
          if (!mutationsSubject.getValue().includes(mutation)) return of({})

          const queryIsOver$ = mutation.mutation$.pipe(
            map(({ data, error }) => error || data)
          )

          const isThisCurrentFunctionLastOneCalled = trigger$.pipe(
            take(1),
            map(() => mapOperator === "concat"),
            startWith(true),
            takeUntil(queryIsOver$)
          )

          const result$ = combineLatest([
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
            takeUntil(cancel$.pipe()),
            mergeResults,
            finalize(() => {
              removeMutation(mutation)
            })
          )

          return result$
        }),
        mergeResults,
        (__queryTriggerHook as typeof identity) ?? identity
      )
    }),
    (__queryFinalizeHook as typeof identity) ?? identity,
    shareReplay(1)
  )

  cancel$.subscribe(() => {
    /**
     * on cancel we remove all queries because they should either be cancelled
     * or not run on next switch
     */
    if (mutationsSubject.getValue().length === 0) return

    mutationsSubject.next([])
  })

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
    cancel$,
    destroy,
    mutationsSubject,
    getClosed: () => closed
  }
}
