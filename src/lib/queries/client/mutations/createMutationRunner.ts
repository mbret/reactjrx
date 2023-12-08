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
  merge,
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
import { type Mutation } from "./Mutation"
import { type DefaultError } from "../types"
import { type MutationCache } from "./MutationCache"
import { type QueryClient } from "../createClient"

export type MutationRunner = ReturnType<typeof createMutationRunner>

export const createMutationRunner = <
  TData,
  TError = DefaultError,
  MutationArg = void,
  TContext = unknown
>({
  __queryFinalizeHook,
  __queryInitHook,
  __queryTriggerHook,
  mutationKey,
  mutationCache,
  client
}: { mutationCache: MutationCache; client: QueryClient } & Pick<
  MutationOptions<TData, TError, MutationArg, TContext>,
  | "__queryInitHook"
  | "__queryTriggerHook"
  | "__queryFinalizeHook"
  | "mutationKey"
>) => {
  type LocalMutation = Mutation<TData, TError, MutationArg, TContext>
  type LocalMutationOptions = MutationOptions<
    TData,
    TError,
    MutationArg,
    TContext
  >
  const trigger$ = new Subject<{
    args: MutationArg
    options: LocalMutationOptions
  }>()
  const cancel$ = new Subject<void>()
  let closed = false
  const mapOperator$ = new BehaviorSubject<LocalMutationOptions["mapOperator"]>(
    "merge"
  )

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

  const runner$ = stableMapOperator$.pipe(
    (__queryInitHook as typeof identity) ?? identity,
    mergeMap((mapOperator) => {
      const switchOperator =
        mapOperator === "concat"
          ? concatMap
          : mapOperator === "switch"
            ? switchMap
            : mergeMap

      let mutationsForCurrentMapOperatorSubject: LocalMutation[] = []

      const removeMutation = (mutation: LocalMutation) => {
        mutationsForCurrentMapOperatorSubject =
          mutationsForCurrentMapOperatorSubject.filter(
            (item) => item !== mutation
          )

        mutationCache.remove(mutation)
      }

      return trigger$.pipe(
        takeUntil(stableMapOperator$.pipe(skip(1))),
        map(({ args, options }) => {
          const mutation = mutationCache.build<
            TData,
            TError,
            MutationArg,
            TContext
          >(client, {
            ...options,
            mapOperator
          })

          mutationsForCurrentMapOperatorSubject = [
            ...mutationsForCurrentMapOperatorSubject,
            mutation
          ]

          return { mutation, args }
        }),
        switchOperator(({ mutation, args }) => {
          if (
            !mutationCache.find<TData, TError, MutationArg, TContext>({
              predicate: (item) => item === mutation
            })
          )
            return of({})

          const mutation$ = mutation.execute(args)

          /**
           * @important
           * we need to make sure to unsubscribe to the mutation.
           * either when it is finished or by cancelling this one in the
           * runner.
           */
          const queryIsOver$ = merge(
            cancel$,
            mutation$.pipe(
              filter(({ status }) => status === "success" || status === "error")
            )
          )

          const isThisCurrentFunctionLastOneCalled = trigger$.pipe(
            take(1),
            map(() => mapOperator === "concat"),
            startWith(true),
            takeUntil(queryIsOver$)
          )

          const result$ = combineLatest([
            mutation$,
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
    mutationCache.removeBy({
      mutationKey,
      exact: true
    })
  })

  return {
    mutationKey,
    runner$,
    trigger: ({
      args,
      options
    }: {
      args: MutationArg
      options: MutationOptions<TData, Error, MutationArg, TContext>
    }) => {
      mapOperator$.next(options.mapOperator)
      trigger$.next({ args, options })
    },
    cancel$,
    destroy,
    getClosed: () => closed
  }
}
