import {
  filter,
  switchMap,
  map,
  distinctUntilChanged,
  merge,
  combineLatest,
  mergeMap,
  skip,
  last,
  tap,
  first
} from "rxjs"
import {
  type MutateOptions,
  type MutationState,
  type MutationFilters
} from "../types"
import { isDefined } from "../../../../utils/isDefined"
import { getDefaultMutationState } from "../defaultMutationState"
import { type QueryClient } from "../../createClient"
import { type DefaultError } from "../../types"
import { type Mutation } from "../Mutation"
import { shallowEqual } from "../../../../utils/shallowEqual"
import { nanoid } from "../../keys/nanoid"
import {
  type MutationObserverOptions,
  type MutationObserverResult
} from "./types"

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
  #currentMutation?: Mutation<TData, TError, TVariables, TContext>

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

    // allow methods to be destructured
    this.mutate = this.mutate.bind(this)
    this.reset = this.reset.bind(this)
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

  /**
   * @todo observer current mutation only
   */
  observeBy(filters: MutationFilters) {
    const mutations = this.client.getMutationCache().findAll(filters)
    const finalState = this.reduceStateFromMutations(mutations)

    const lastValue = this.getObserverResultFromState(finalState)

    const result$ = this.client
      .getMutationCache()
      .observeMutationsBy(filters)
      .pipe(
        switchMap((mutations) =>
          combineLatest(
            mutations.map((mutation) =>
              mutation.state$.pipe(
                map((state) => ({ state, options: mutation.options }))
              )
            )
          )
        ),
        map(this.reduceStateFromMutations),
        filter(isDefined),
        map(this.getObserverResultFromState),
        distinctUntilChanged(shallowEqual),
        tap({
          subscribe: () => {
            this.numberOfObservers++
          },
          finalize: () => {
            this.numberOfObservers--
          }
        })
      )

    return { result$, lastValue }
  }

  subscribe(
    subscription: (
      result: MutationObserverResult<TData, TError, TVariables, TContext>
    ) => void
  ) {
    const sub = this.client
      .getMutationCache()
      .mutations$.pipe(
        mergeMap((mutations) => {
          const observed$ = mutations.map((mutation) =>
            mutation.state$.pipe(
              // we only want next changes
              skip(1)
            )
          )

          return merge(...observed$)
        }),
        tap({
          subscribe: () => {
            this.numberOfObservers++
          },
          finalize: () => {
            this.numberOfObservers--
          }
        })
      )
      .subscribe((state) => {
        subscription(this.getObserverResultFromState(state))
      })

    return () => {
      sub.unsubscribe()
    }
  }

  async mutate(
    variables: TVariables,
    options?: MutateOptions<TData, TError, TVariables, TContext>
  ) {
    const mutation = this.client.mutationRunners.mutate<
      TData,
      TError,
      TVariables,
      TContext
    >(variables as any, this.options as any)

    this.#currentMutation = mutation

    this.client.getMutationCache().removed$.pipe(
      filter((mutation) => mutation === this.#currentMutation),
      first(),
      tap((mutation) => {
        if (this.#currentMutation === mutation) {
          this.#currentMutation = undefined
        }
      })
    )

    return await new Promise<TData>((resolve, reject) => {
      mutation
        .observeTillFinished()
        .pipe(last())
        .subscribe({
          error: (error) => {
            reject(error)
          },
          next: (data) => {
            console.log("finished", this.numberOfObservers)
            if (data.error) {
              if (this.numberOfObservers) {
                options?.onError &&
                  options?.onError(data.error, variables, data.context)
                options?.onSettled &&
                  options?.onSettled(
                    data.data,
                    data.error,
                    variables,
                    data.context
                  )
              }
              reject(data.error)
            } else {
              if (this.numberOfObservers) {
                options?.onSuccess &&
                  options?.onSuccess(
                    data.data as TData,
                    variables,
                    data.context as TContext
                  )
                options?.onSettled &&
                  options?.onSettled(
                    data.data,
                    data.error,
                    variables,
                    data.context
                  )
              }
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
    this.#currentMutation?.reset()
  }
}
