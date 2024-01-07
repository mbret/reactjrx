/* eslint-disable @typescript-eslint/naming-convention */
import {
  BehaviorSubject,
  type ObservedValueOf,
  Subject,
  combineLatest,
  concatMap,
  defer,
  distinctUntilChanged,
  filter,
  finalize,
  first,
  identity,
  map,
  merge,
  mergeMap,
  scan,
  shareReplay,
  skip,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap
} from "rxjs"
import { isDefined } from "../../../../utils/isDefined"
import { type DefaultError } from "../../types"
import { type MutationCache } from "../cache/MutationCache"
import { type MutationObserverOptions } from "../observers/types"
import { type Mutation } from "../mutation/Mutation"
import { shallowEqual } from "../../../../utils/shallowEqual"
import { getDefaultMutationState } from "../defaultMutationState"
import { trackSubscriptions } from "../../../../utils/operators/trackSubscriptions"
import { type MutationOptions, type MutationState } from "../mutation/types"

export type MutationRunner<
  TData,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> = ReturnType<typeof createMutationRunner<TData, TError, TVariables, TContext>>

export const createMutationRunner = <
  TData,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
>(
  mutationCache: MutationCache,
  {
    __queryFinalizeHook,
    __queryInitHook,
    __queryTriggerHook,
    mutationKey
  }: MutationObserverOptions<TData, TError, TVariables, TContext>
) => {
  const refCountSubject = new BehaviorSubject(0)
  type LocalMutationOptions = MutationOptions<
    TData,
    TError,
    TVariables,
    TContext
  >
  const trigger$ = new Subject<{
    args: TVariables
    options: LocalMutationOptions
    mutation: Mutation<TData, TError, TVariables, TContext>
  }>()
  let closed = false
  const mapOperator$ = new BehaviorSubject<LocalMutationOptions["mapOperator"]>(
    "merge"
  )

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

      return trigger$.pipe(
        takeUntil(stableMapOperator$.pipe(skip(1))),
        switchOperator(({ args, mutation }) => {
          const newMergeTrigger$ = trigger$.pipe(
            filter(() => mapOperator === "merge"),
            first()
          )
          const newConcatTrigger$ = trigger$.pipe(
            filter(() => mapOperator === "concat"),
            first()
          )

          const state$ = defer(() => {
            const state$ = mutation.state$.pipe(skip(1))

            const mutation$ = mutation.execute(args)

            /**
             * @important
             * we need to make sure to unsubscribe to the mutation.
             * either when it is finished or by cancelling this one in the
             * runner.
             */
            const queryIsOver$ = merge(
              mutation$.pipe(
                filter(
                  ({ status }) => status === "success" || status === "error"
                )
              ),
              mutation.destroyed$
            )

            const isThisCurrentFunctionLastOneCalled = trigger$.pipe(
              take(1),
              map(() => mapOperator === "concat"),
              startWith(true),
              takeUntil(queryIsOver$)
            )

            const newConcatTrigger$ = trigger$.pipe(
              filter(() => mapOperator === "concat"),
              first()
            )

            const result$ = combineLatest([
              /**
               * This one is used to
               * - trigger the first pending state (before query)
               * - hold the reference to mutation until it finish or is switched
               * @todo avoid duplicate with below mutation$
               */
              merge(
                mutation$.pipe(
                  tap((s) => {
                    console.log("SSSS", s)
                  })
                ),
                state$.pipe(
                  takeUntil(
                    merge(
                      refCountSubject.pipe(filter((value) => value === 0)),
                      newConcatTrigger$
                    )
                  )
                )
              ),
              isThisCurrentFunctionLastOneCalled
            ]).pipe(
              map(([result, isLastMutationCalled]) => {
                if (
                  (result.status === "success" || result.status === "error") &&
                  !isLastMutationCalled
                ) {
                  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                  return {} as Partial<
                    MutationState<TData, TError, TVariables, TContext>
                  >
                }

                return result
              }),
              finalize(() => {
                console.log("mutation runner finalize")
              }),
              (__queryFinalizeHook as typeof identity) ?? identity
            )

            return result$
          })

          return merge(
            mutation.state$.pipe(
              skip(1),
              takeUntil(
                merge(
                  newConcatTrigger$,
                  newMergeTrigger$,
                  refCountSubject.pipe(filter((value) => value === 0))
                )
              )
            ),
            state$
          )
        }),
        scan((acc, current) => {
          return {
            ...acc,
            ...current,
            ...(current.status === "pending" && {
              data: current.data ?? acc.data
            }),
            ...(current.status === "pending" && {
              error: current.error ?? acc.error
            })
          }
        }, getDefaultMutationState<TData, TError, TVariables, TContext>()),
        distinctUntilChanged(
          ({ data: prevData, ...prev }, { data: currData, ...curr }) =>
            shallowEqual(prev, curr) && shallowEqual(prevData, currData)
        ),
        tap((s) => {
          console.log("s", s)
        }),
        (__queryTriggerHook as typeof identity) ?? identity
      )
    }),
    shareReplay(1),
    trackSubscriptions((count) => {
      refCountSubject.next(count)
    })
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
  }

  return {
    mutationKey,
    runner$,
    trigger: ({
      args,
      options,
      mutation
    }: ObservedValueOf<typeof trigger$>) => {
      mapOperator$.next(options.mapOperator)
      trigger$.next({ args, options, mutation })
    },
    destroy,
    getClosed: () => closed
  }
}
