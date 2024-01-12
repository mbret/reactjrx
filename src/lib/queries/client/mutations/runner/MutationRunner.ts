/* eslint-disable @typescript-eslint/naming-convention */
import {
  BehaviorSubject,
  type ObservedValueOf,
  Subject,
  concatMap,
  defer,
  distinctUntilChanged,
  filter,
  identity,
  merge,
  mergeMap,
  scan,
  shareReplay,
  skip,
  switchMap,
  takeUntil,
  type Observable,
  last,
  EMPTY
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

  public state$: Observable<MutationState<TData, TError, TVariables, TContext>>

  constructor({
    __queryFinalizeHook
  }: MutationObserverOptions<TData, TError, TVariables, TContext> = {}) {
    const refCountSubject = new BehaviorSubject(0)

    const noMoreObservers$ = refCountSubject.pipe(
      filter((value) => value === 0)
    )

    const stableMapOperator$ = this.mapOperator$.pipe(
      filter(isDefined),
      distinctUntilChanged()
    )

    this.state$ = stableMapOperator$.pipe(
      mergeMap((mapOperator) => {
        const switchOperator =
          mapOperator === "concat"
            ? concatMap
            : mapOperator === "switch"
              ? switchMap
              : mergeMap

        const mergeTrigger$ = this.trigger$.pipe(
          filter(() => mapOperator === "merge")
        )

        return this.trigger$.pipe(
          takeUntil(stableMapOperator$.pipe(skip(1))),
          switchOperator(({ args, mutation }) => {
            const execute$ = defer(() => {
              mutation.execute(args)

              return EMPTY
            })

            const resetState$ = mutation.observeTillFinished().pipe(
              last(),
              mergeMap(() => mutation.state$),
              takeUntil(this.trigger$)
            )

            const stateUntilFinished$ = mutation
              .observeTillFinished()
              .pipe(skip(1))

            return merge(stateUntilFinished$, resetState$, execute$).pipe(
              (__queryFinalizeHook as typeof identity) ?? identity,
              takeUntil(merge(noMoreObservers$, mergeTrigger$))
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
          )
        )
      }),
      shareReplay({
        refCount: true,
        bufferSize: 1
      }),
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
}
