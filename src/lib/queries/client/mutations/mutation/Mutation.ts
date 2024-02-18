import {
  merge,
  tap,
  switchMap,
  Subject,
  takeUntil,
  type Observable,
  shareReplay,
  BehaviorSubject,
  concat,
  toArray,
  mergeMap,
  NEVER,
  startWith
} from "rxjs"
import { getDefaultMutationState } from "../defaultMutationState"
import { type DefaultError } from "../../types"
import { type MutationCache } from "../cache/MutationCache"
import { makeObservable } from "../../utils/makeObservable"
import {
  type MutationState,
  type MutationMeta,
  type MutationOptions
} from "./types"
import { executeMutation } from "./executeMutation"
import { trackSubscriptions } from "../../../../utils/operators/trackSubscriptions"
import { observeUntilFinished } from "./observeUntilFinished"

interface MutationConfig<TData, TError, TVariables, TContext> {
  mutationCache: MutationCache
  options: MutationOptions<TData, TError, TVariables, TContext>
  defaultOptions?: MutationOptions<TData, TError, TVariables, TContext>
  state?: MutationState<TData, TError, TVariables, TContext>
}

export class Mutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> {
  readonly #observerCount = new BehaviorSubject(0)
  readonly #cancelSubject = new Subject<void>()
  readonly #executeSubject = new Subject<TVariables>()

  public state: MutationState<TData, TError, TVariables, TContext> =
    getDefaultMutationState<TData, TError, TVariables, TContext>()

  public state$: Observable<typeof this.state>
  public options: MutationOptions<TData, TError, TVariables, TContext>
  public observerCount$ = this.#observerCount.asObservable()
  public cancelled$ = this.#cancelSubject.asObservable()

  constructor({
    options,
    mutationCache,
    state
  }: MutationConfig<TData, TError, TVariables, TContext>) {
    this.options = options
    this.state = state ?? this.state

    const execution$ = this.#executeSubject.pipe(
      switchMap((variables) =>
        executeMutation<TData, TError, TVariables, TContext>({
          options: {
            ...this.options,
            onMutate: (variables) => {
              const onCacheMutate$ = makeObservable(
                () =>
                  mutationCache.config.onMutate?.(
                    variables,
                    this as Mutation<any, any, any, any>
                  )
              ) as Observable<TContext>

              // eslint-disable-next-line @typescript-eslint/promise-function-async
              const optionsOnMutate = () => {
                return this.options.onMutate?.(variables)
              }

              const onOptionMutate$ = makeObservable(optionsOnMutate)

              const context$ = onCacheMutate$.pipe(
                mergeMap(() => onOptionMutate$)
              )

              return context$
            },
            onError: (error, variables, context) => {
              const onCacheError$ = makeObservable(
                () =>
                  mutationCache.config.onError?.(
                    error as any,
                    variables,
                    context,
                    this as Mutation<any, any, any, any>
                  )
              )

              const onOptionError$ = makeObservable(
                () => this.options.onError?.(error, variables, context)
              )

              return concat(onCacheError$, onOptionError$).pipe(toArray())
            },
            onSettled: (data, error, variables, context) => {
              const onCacheSuccess$ = makeObservable(
                () =>
                  mutationCache.config.onSettled?.(
                    data,
                    error as Error,
                    variables,
                    context,
                    this as Mutation<any, any, any, any>
                  )
              )

              const onOptionSettled$ = makeObservable(
                () => this.options.onSettled?.(data, error, variables, context)
              )

              return concat(onCacheSuccess$, onOptionSettled$).pipe(toArray())
            },
            onSuccess: (data, variables, context) => {
              const onCacheSuccess$ = makeObservable(
                () =>
                  mutationCache.config.onSuccess?.(
                    data,
                    variables,
                    context,
                    this as Mutation<any, any, any, any>
                  )
              )

              const onOptionSuccess$ = makeObservable(
                () => this.options.onSuccess?.(data, variables, context)
              )

              return concat(onCacheSuccess$, onOptionSuccess$).pipe(toArray())
            }
          },
          state: this.state,
          variables
        }).pipe(takeUntil(this.#cancelSubject))
      )
    )

    this.state$ = merge(
      execution$,
      /**
       * We keep state forever since only a explicit destroy
       * may terminate the mutation
       */
      NEVER
    ).pipe(
      startWith(this.state),
      tap((value) => {
        this.state = { ...this.state, ...value }
      }),
      takeUntil(this.#cancelSubject),
      /**
       * refCount as true somewhat make NEVER complete when there are
       * no more observers. I thought I should have to complete manually (which is
       * why we still cancel the observable when we remove it from cache)
       */
      shareReplay({ bufferSize: 1, refCount: false }),
      trackSubscriptions((count) => {
        this.#observerCount.next(count)
      })
    )
  }

  get meta(): MutationMeta | undefined {
    return this.options.meta
  }

  setOptions(
    options?: MutationOptions<TData, TError, TVariables, TContext>
  ): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * @important
   * The resulting observable will complete as soon as the mutation
   * is over, unlike the state which can be re-subscribed later.
   */
  execute(variables: TVariables) {
    this.#executeSubject.next(variables)
    this.#executeSubject.complete()

    return this.state$.pipe(observeUntilFinished)
  }

  continue() {
    return this.execute(this.state.variables as TVariables)
  }

  // @todo merge with query
  cancel() {
    this.#cancelSubject.next()
    this.#cancelSubject.complete()
  }
}
