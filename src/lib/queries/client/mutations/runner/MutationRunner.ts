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
  tap,
  type Observable
} from "rxjs"
import { isDefined } from "../../../../utils/isDefined"
import { type DefaultError } from "../../types"
import { type MutationObserverOptions } from "../observers/types"
import { type Mutation } from "../mutation/Mutation"
import { shallowEqual } from "../../../../utils/shallowEqual"
import { getDefaultMutationState } from "../defaultMutationState"
import { trackSubscriptions } from "../../../../utils/operators/trackSubscriptions"
import { type MutationOptions, type MutationState } from "../mutation/types"
import { type MapOperator } from "../types"

export class MutationRunner<
  TData,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> {
  protected trigger$ = new Subject<{
    args: TVariables
    options: MutationOptions<TData, TError, TVariables, TContext>
    mutation: Mutation<TData, TError, TVariables, TContext>
  }>()

  protected mapOperator$ = new BehaviorSubject<MapOperator>("merge")

  public closed = false

  public state$: Observable<MutationState<TData, TError, TVariables, TContext>>

  constructor({
    __queryFinalizeHook,
    __queryInitHook,
    __queryTriggerHook
  }: MutationObserverOptions<TData, TError, TVariables, TContext>) {
    const refCountSubject = new BehaviorSubject(0)

    const stableMapOperator$ = this.mapOperator$.pipe(
      filter(isDefined),
      distinctUntilChanged()
    )

    this.state$ = stableMapOperator$.pipe(
      (__queryInitHook as typeof identity) ?? identity,
      mergeMap((mapOperator) => {
        const switchOperator =
          mapOperator === "concat"
            ? concatMap
            : mapOperator === "switch"
              ? switchMap
              : mergeMap

        return this.trigger$.pipe(
          takeUntil(stableMapOperator$.pipe(skip(1))),
          switchOperator(({ args, mutation }) => {
            const newMergeTrigger$ = this.trigger$.pipe(
              filter(() => mapOperator === "merge"),
              first()
            )
            const newConcatTrigger$ = this.trigger$.pipe(
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

              const isThisCurrentFunctionLastOneCalled = this.trigger$.pipe(
                take(1),
                map(() => mapOperator === "concat"),
                startWith(true),
                takeUntil(queryIsOver$)
              )

              const newConcatTrigger$ = this.trigger$.pipe(
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
                    (result.status === "success" ||
                      result.status === "error") &&
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
          (__queryTriggerHook as typeof identity) ?? identity
        )
      }),
      shareReplay(1),
      trackSubscriptions((count) => {
        refCountSubject.next(count)
      })
    )
  }

  trigger({ args, options, mutation }: ObservedValueOf<typeof this.trigger$>) {
    if (options.mapOperator) {
      this.mapOperator$.next(options.mapOperator)
    }
    this.trigger$.next({ args, options, mutation })
  }

  /**
   * Mutation can be destroyed in two ways
   * - caller unsubscribe to the mutation
   * - caller call destroy directly
   */
  destroy() {
    if (closed) {
      throw new Error("Trying to close an already closed mutation")
    }

    this.closed = true

    this.mapOperator$.complete()
    this.trigger$.complete()
  }
}
