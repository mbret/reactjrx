/* eslint-disable @typescript-eslint/naming-convention */
import {
  BehaviorSubject,
  Subject,
  concatMap,
  defer,
  filter,
  identity,
  merge,
  mergeMap,
  shareReplay,
  skip,
  takeUntil,
  type Observable,
  last,
  EMPTY,
  tap,
  map
} from "rxjs"
import { type DefaultError } from "../../types"
import { type MutationObserverOptions } from "../observers/types"
import { type Mutation } from "../mutation/Mutation"
import { trackSubscriptions } from "../../../../utils/operators/trackSubscriptions"
import { type MutationOptions, type MutationState } from "../mutation/types"
import { observeUntilFinished } from "../mutation/observeUntilFinished"

interface TriggerSubject<
  TData,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> {
  args: TVariables
  options: MutationOptions<TData, TError, TVariables, TContext>
  mutation: Mutation<TData, TError, TVariables, TContext>
}

export class MutationRunner<
  TData,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> {
  readonly #trigger$ = new Subject<
    TriggerSubject<TData, TError, TVariables, TContext>
  >()

  public state$: Observable<{
    state: MutationState<TData, TError, TVariables, TContext>
    mutation: Mutation<TData, TError, TVariables, TContext>
  }>

  constructor({
    __queryFinalizeHook
  }: MutationObserverOptions<TData, TError, TVariables, TContext> = {}) {
    const refCountSubject = new BehaviorSubject(0)

    const noMoreObservers$ = refCountSubject.pipe(
      filter((value) => value === 0)
    )

    this.state$ = this.#trigger$.pipe(
      concatMap(({ args, mutation, options }) => {
        const mapOperator = options.mapOperator ?? "merge"

        const mergeTrigger$ = this.#trigger$.pipe(
          filter(() => mapOperator === "merge")
        )

        const switchTrigger$ = this.#trigger$.pipe(
          filter(() => mapOperator === "switch"),
          tap(() => {
            mutation.cancel()
          })
        )

        const deferExecution$ = defer(() => {
          mutation.execute(args)

          return EMPTY
        })

        const resetState$ = mutation.state$.pipe(
          observeUntilFinished,
          last(),
          mergeMap(() => mutation.state$),
          takeUntil(this.#trigger$)
        )

        const stateUntilFinished$ = mutation.state$.pipe(
          observeUntilFinished,
          skip(1)
        )

        const observeUntil$ = merge(
          noMoreObservers$,
          mergeTrigger$,
          switchTrigger$,
          mutation.cancelled$
        )

        return merge(
          stateUntilFinished$,
          resetState$,
          /**
           * We defer execution so that we return at least
           * the current state first (same mechanism is used for query)
           */
          deferExecution$
        ).pipe(
          map((state) => ({ state, mutation })),
          (__queryFinalizeHook as typeof identity) ?? identity,
          takeUntil(observeUntil$)
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

  trigger({
    args,
    options,
    mutation
  }: TriggerSubject<TData, TError, TVariables, TContext>) {
    this.#trigger$.next({ args, options, mutation })
  }
}
