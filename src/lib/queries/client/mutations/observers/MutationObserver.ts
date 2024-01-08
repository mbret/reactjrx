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
import {
  type MutationRunner,
  createMutationRunner
} from "../runner/MutationRunner"
import { type MutationState } from "../mutation/types"

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

  protected mutationRunner: MutationRunner<TData, TError, TVariables, TContext>

  readonly #currentMutationSubject = new BehaviorSubject<
    | {
        mutation: Mutation<TData, TError, TVariables, TContext>
        options?: MutateOptions<TData, TError, TVariables, TContext>
      }
    | undefined
  >(undefined)

  readonly observed$: Observable<{
    state: MutationObserverResult<TData, TError, TVariables, TContext>
    options: MutateOptions<TData, TError, TVariables, TContext> | undefined
  }>

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
    > = {}
  ) {
    this.options.mutationKey = this.options?.mutationKey ?? [nanoid()]
    this.mutationRunner = createMutationRunner<
      TData,
      TError,
      TVariables,
      TContext
    >(this.client.getMutationCache(), this.options)

    // allow methods to be destructured
    this.mutate = this.mutate.bind(this)
    this.reset = this.reset.bind(this)

    this.result$ = this.mutationRunner.runner$.pipe(
      map((state) => ({
        state: this.getObserverResultFromState(state),
        options: {} as any
      }))
    )

    this.observed$ = this.#currentMutationSubject.pipe(
      switchMap(
        (maybeMutation) =>
          maybeMutation?.mutation.state$.pipe(
            map((state) => ({
              state: this.getObserverResultFromState(state),
              options: maybeMutation.options
            }))
          ) ?? EMPTY
      ),
      mergeMap(({ state, options }) => {
        if (state.status === "error") {
          options?.onError &&
            options?.onError(
              state.error as TError,
              state.variables,
              state.context
            )
          options?.onSettled &&
            options?.onSettled(
              state.data,
              state.error,
              state.variables,
              state.context
            )
        }
        if (state.status === "success") {
          options?.onSuccess &&
            options?.onSuccess(
              state.data as TData,
              state.variables,
              state.context as TContext
            )
          options?.onSettled &&
            options?.onSettled(
              state.data,
              state.error,
              state.variables,
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
    this.options = this.client.defaultMutationOptions({
      mutationKey: this.options.mutationKey,
      ...options
    })

    if (this.options.mutationKey) {
      this.client
        .getMutationCache()
        .findAll({
          exact: true,
          mutationKey: this.options.mutationKey
        })
        .forEach((mutation) => {
          mutation.setOptions(options)
        })
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

  protected reduceStateFromMutations(
    mutations: Array<Pick<Mutation<any, any, any, any>, "options" | "state">>
  ) {
    return mutations.reduce(
      (acc, { state, options }) => {
        if (options.mapOperator === "switch") return state

        if (acc && state.submittedAt >= acc.submittedAt) {
          return {
            ...state,
            data: state.data ?? acc.data,
            error: state.error ?? acc.error
          }
        }

        return acc
      },
      mutations[0]?.state ?? getDefaultMutationState()
    )
  }

  observe() {
    const lastValue = this.getObserverResultFromState(
      this.#currentMutationSubject.getValue()?.mutation.state ??
        getDefaultMutationState()
    )

    const result$ = merge(this.observed$, this.result$).pipe(
      map(({ state }) => state)
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

    this.mutationRunner.runner$
      .pipe(takeUntil(mutation.observeTillFinished().pipe(last())))
      .subscribe()

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

  cancel() {
    this.#currentMutationSubject.getValue()?.mutation.destroy()
  }

  destroy() {
    this.mutationRunner.destroy()
  }
}
