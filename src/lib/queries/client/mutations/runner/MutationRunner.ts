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
  takeUntil,
  type Observable,
  last,
  EMPTY,
  tap
} from "rxjs"
import { type DefaultError } from "../../types"
import { type MutationObserverOptions } from "../observers/types"
import { type Mutation } from "../mutation/Mutation"
import { shallowEqual } from "../../../../utils/shallowEqual"
import { getDefaultMutationState } from "../defaultMutationState"
import { trackSubscriptions } from "../../../../utils/operators/trackSubscriptions"
import { type MutationOptions, type MutationState } from "../mutation/types"

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

  public state$: Observable<MutationState<TData, TError, TVariables, TContext>>

  constructor({
    __queryFinalizeHook
  }: MutationObserverOptions<TData, TError, TVariables, TContext> = {}) {
    const refCountSubject = new BehaviorSubject(0)

    const noMoreObservers$ = refCountSubject.pipe(
      filter((value) => value === 0)
    )

    this.state$ = this.trigger$.pipe(
      concatMap(({ args, mutation, options }) => {
        const mapOperator = options.mapOperator ?? "merge"

        const mergeTrigger$ = this.trigger$.pipe(
          filter(() => mapOperator === "merge")
        )

        const switchTrigger$ = this.trigger$.pipe(
          filter(() => mapOperator === "switch"),
          tap(() => {
            mutation.reset()
          })
        )

        const execute$ = defer(() => {
          mutation.execute(args)

          return EMPTY
        })

        const resetState$ = mutation.observeTillFinished().pipe(
          last(),
          mergeMap(() => mutation.state$),
          takeUntil(this.trigger$)
        )

        const stateUntilFinished$ = mutation.observeTillFinished().pipe(skip(1))

        return merge(stateUntilFinished$, resetState$, execute$).pipe(
          (__queryFinalizeHook as typeof identity) ?? identity,
          takeUntil(merge(noMoreObservers$, mergeTrigger$, switchTrigger$))
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
    this.trigger$.next({ args, options, mutation })
  }
}
