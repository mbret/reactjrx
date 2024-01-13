import {
  switchMap,
  map,
  BehaviorSubject,
  EMPTY,
  type Observable,
  mergeMap,
  merge,
  takeUntil,
  last,
  filter
} from "rxjs"
import { type MutateOptions } from "../types"
import { getDefaultMutationState } from "../defaultMutationState"
import { type QueryClient } from "../../createClient"
import { type DefaultError } from "../../types"
import { type Mutation } from "../mutation/Mutation"
import { nanoid } from "../../keys/nanoid"
import {
  type MutationObserverOptions,
  type MutationObserverResult
} from "./types"
import { MutationRunner } from "../runner/MutationRunner"
import { type MutationState } from "../mutation/types"
import { isDefined } from "../../../../utils/isDefined"
import { compareKeys } from "../../keys/compareKeys"

/**
 * Provide API to observe mutations results globally.
 * Observe runners and map their results in a hash map.
 */
export class MutationObserver<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> {
  protected numberOfObservers = 0
  protected mutationRunner: MutationRunner<any, any, any, TContext>

  readonly #currentMutationSubject = new BehaviorSubject<
    | {
        mutation: Mutation<TData, TError, TVariables, TContext>
        options?: MutateOptions<TData, TError, TVariables, TContext>
      }
    | undefined
  >(undefined)

  /**
   * @important
   * Used to maintain persistance to latest mutation. This ensure
   * - mutation does not get garbage collected
   * - mutation mutate options are run on finish
   */
  readonly observed$: Observable<never>

  readonly result$: Observable<{
    state: MutationObserverResult<TData, TError, TVariables, TContext>
    options: MutateOptions<TData, TError, TVariables, TContext> | undefined
  }>

  constructor(
    protected client: QueryClient,
    protected options: MutationObserverOptions<
      TData,
      TError,
      TVariables,
      TContext
    > = {},
    mutationRunner?: MutationRunner<any, any, any, TContext>
  ) {
    this.options.mutationKey = this.options?.mutationKey ?? [nanoid()]

    this.mutationRunner =
      mutationRunner ??
      new MutationRunner<TData, TError, TVariables, TContext>(this.options)

    // allow methods to be destructured
    this.mutate = this.mutate.bind(this)
    this.reset = this.reset.bind(this)

    this.result$ = this.mutationRunner.state$.pipe(
      map((state) => ({
        state: this.getObserverResultFromState(state),
        options: {} as any
      }))
    )

    /**
     * @important
     * Make sure we always subscribe to the runner for every mutation.
     * It will ensure the runner starts and keep running as long as there are
     * mutations. Runner is automatically unsubscribed when they all finished.
     */
    this.#currentMutationSubject
      .pipe(
        filter(isDefined),
        mergeMap((mutation) =>
          this.mutationRunner.state$.pipe(
            takeUntil(mutation.mutation.observeTillFinished().pipe(last()))
          )
        )
      )
      .subscribe()

    this.observed$ = this.#currentMutationSubject.pipe(
      switchMap(
        (maybeMutation) =>
          maybeMutation?.mutation.observeTillFinished().pipe(
            last(),
            map((state) => ({
              state,
              options: maybeMutation.options
            }))
          ) ?? EMPTY
      ),
      mergeMap(({ state, options }) => {
        if (state.status === "error") {
          options?.onError &&
            options?.onError(
              state.error as TError,
              state.variables as TVariables,
              state.context
            )
          options?.onSettled &&
            options?.onSettled(
              state.data,
              state.error,
              state.variables as TVariables,
              state.context
            )
        }
        if (state.status === "success") {
          options?.onSuccess &&
            options?.onSuccess(
              state.data as TData,
              state.variables as TVariables,
              state.context as TContext
            )
          options?.onSettled &&
            options?.onSettled(
              state.data,
              state.error,
              state.variables as TVariables,
              state.context
            )
        }

        return EMPTY
      })
    )
  }

  setOptions(
    options: MutationObserverOptions<TData, TError, TVariables, TContext>
  ) {
    const prevOptions = this.options
    this.options = this.client.defaultMutationOptions({
      mutationKey: this.options.mutationKey,
      ...options
    })

    this.#currentMutationSubject.getValue()?.mutation.setOptions(this.options)

    if (
      this.options.mutationKey &&
      prevOptions.mutationKey &&
      !compareKeys(this.options.mutationKey, prevOptions.mutationKey, {
        exact: true
      })
    ) {
      this.reset()
    }
  }

  protected getObserverResultFromState = (
    state: MutationState<any, any, any, any>
  ) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      ...getDefaultMutationState(),
      ...state,
      isSuccess: state.status === "success",
      isPending: state.status === "pending",
      isIdle: state.status === "idle",
      isError: state.status === "error",
      mutate: this.mutate,
      reset: this.reset
    } as MutationObserverResult<TData, TError, TVariables, TContext>
  }

  observe() {
    const lastValue = this.getObserverResultFromState(
      this.#currentMutationSubject.getValue()?.mutation.state ??
        getDefaultMutationState()
    )

    const result$ = merge(
      this.observed$,
      this.result$.pipe(map(({ state }) => state))
    )

    return { result$, lastValue }
  }

  /**
   * @important
   * Compliance react-query only
   */
  subscribe(
    subscription: (
      result: MutationObserverResult<TData, TError, TVariables, TContext>
    ) => void
  ) {
    const sub = this.observe().result$.subscribe((result) => {
      subscription(result)
    })

    return () => {
      sub.unsubscribe()
    }
  }

  async mutate(
    variables: TVariables,
    options: MutateOptions<TData, TError, TVariables, TContext> = {}
  ) {
    const mutation = this.client
      .getMutationCache()
      .build<TData, TError, TVariables, TContext>(this.client, this.options)

    this.#currentMutationSubject.next({ mutation, options })

    this.mutationRunner.trigger({
      args: variables,
      options: this.options,
      mutation
    })

    return await new Promise<TData>((resolve, reject) => {
      mutation
        .observeTillFinished()
        .pipe(last())
        .subscribe({
          error: (error) => {
            reject(error)
          },
          next: (data) => {
            if (data.error) {
              reject(data.error)
            } else {
              resolve(data.data as TData)
            }
          }
        })
    })
  }

  getCurrentResult(): MutationObserverResult<
    TData,
    TError,
    TVariables,
    TContext
  > {
    const mutation = this.client
      .getMutationCache()
      .find({ exact: true, mutationKey: this.options?.mutationKey })

    return this.getObserverResultFromState(
      mutation?.state ?? getDefaultMutationState()
    )
  }

  reset() {
    this.#currentMutationSubject.getValue()?.mutation.reset()
  }
}