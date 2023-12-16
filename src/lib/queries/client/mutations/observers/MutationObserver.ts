import {
  type Observable,
  filter,
  switchMap,
  map,
  distinctUntilChanged,
  merge,
  combineLatest,
  mergeMap,
  skip,
  type ObservedValueOf,
  last
} from "rxjs"
import {
  type MutationOptions,
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
import { type MutationObserverResult } from "./types"

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
  constructor(
    protected client: QueryClient,
    protected options?: Partial<
      MutationOptions<TData, TError, TVariables, TContext>
    >
  ) {}

  protected getDerivedState = (
    state: MutationState<any, any, any, any>
  ): MutationObserverResult => {
    return {
      ...getDefaultMutationState(),
      ...state,
      isSuccess: state.status === "success",
      isPending: state.status === "pending",
      isIdle: state.status === "idle",
      isError: state.status === "error"
    }
  }

  observeBy(filters: MutationFilters): {
    result$: Observable<MutationObserverResult<any>>
    lastValue: MutationObserverResult<any>
  } {
    const reduceStateFromMutation = (
      values: Array<Pick<Mutation, "state" | "options">>
    ) =>
      values.reduce(
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
        values[0]?.state ?? getDefaultMutationState()
      )

    const mutations = this.client.getMutationCache().findAll(filters)

    const lastValue = this.getDerivedState(reduceStateFromMutation(mutations))

    const result$ = this.client.getMutationCache().mutationsBy(filters).pipe(
      switchMap((mutations) =>
        combineLatest(
          mutations.map((mutation) =>
            this.observe(mutation).pipe(
              map((state) => ({ state, options: mutation.options }))
            )
          )
        )
      ),
      map(reduceStateFromMutation),
      filter(isDefined),
      map(this.getDerivedState),
      distinctUntilChanged(shallowEqual)
    )

    return { result$, lastValue }
  }

  observe(mutation: Mutation) {
    return mutation.state$
  }

  subscribe(subscription: () => void) {
    const sub = this.client.getMutationCache().mutations$
      .pipe(
        mergeMap((mutations) => {
          const observed$ = mutations.map((mutation) =>
            this.observe(mutation).pipe(
              // we only want next changes
              skip(1)
            )
          )

          return merge(...observed$)
        })
      )
      .subscribe(subscription)

    return () => {
      sub.unsubscribe()
    }
  }

  async mutate(
    variables: TVariables,
    options?: MutateOptions<TData, TError, TVariables, TContext>
  ) {
    const mergedOptions = {
      ...this.options,
      ...options
    }

    const mutation = this.client.client.mutationClient.mutate<
      TData,
      TVariables
    >({
      args: variables,
      options: {
        mutationFn: async () => undefined,
        ...mergedOptions,
        mutationKey: mergedOptions.mutationKey ?? [nanoid()]
      }
    })

    return await new Promise<
      ObservedValueOf<ReturnType<typeof mutation.observeTillFinished>>
    >((resolve, reject) => {
      mutation.observeTillFinished().pipe(last()).subscribe({
        error: reject,
        next: resolve
      })
    })
  }

  reset() {
    this.client.getMutationCache().getAll().forEach((mutation) => {
      mutation.cancel()
    })
  }

  destroy() {}
}
