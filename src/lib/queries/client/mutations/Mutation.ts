/* eslint-disable @typescript-eslint/naming-convention */
import {
  identity,
  map,
  merge,
  of,
  tap,
  switchMap,
  Subject,
  takeUntil,
  concat,
  toArray,
  mergeMap,
  Observable,
  shareReplay,
  takeWhile,
  BehaviorSubject,
  type ObservedValueOf,
  NEVER,
  share,
  iif
} from "rxjs"
import { retryOnError } from "../operators"
import { type MutationState, type MutationOptions, MutationMeta } from "./types"
import { getDefaultMutationState } from "./defaultMutationState"
import { mergeResults } from "./operators"
import { type DefaultError } from "../types"
import { type MutationCache } from "./cache/MutationCache"
import { functionAsObservable } from "../utils/functionAsObservable"

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
  state: MutationState<TData, TError, TVariables, TContext> =
    getDefaultMutationState<TData, TError, TVariables, TContext>()

  state$: Observable<typeof this.state>
  options: MutationOptions<TData, TError, TVariables, TContext>
  mutationCache: MutationCache
  protected observerCount = new BehaviorSubject(0)
  public observerCount$ = this.observerCount.asObservable()

  protected destroySubject = new Subject<void>()
  protected resetSubject = new Subject<void>()
  protected executeSubject = new Subject<TVariables>()

  constructor({
    options,
    mutationCache,
    state
  }: MutationConfig<TData, TError, TVariables, TContext>) {
    this.options = options
    this.mutationCache = mutationCache
    this.state = state ?? this.state

    this.state$ = merge(
      of(this.state),
      this.executeSubject.pipe(
        switchMap((variables) => this.createMutation(variables)),
        tap((value) => {
          this.state = { ...this.state, ...value }
        }),
        takeUntil(this.destroySubject)
      ),
      this.resetSubject.pipe(
        map(() =>
          getDefaultMutationState<TData, TError, TVariables, TContext>()
        )
      ),
      NEVER
    ).pipe(
      /**
       * refCount as true somewhat make NEVER complete when there are
       * no more observers. I thought I should have to complete manually (which is
       * why we still cancel the observable when we remove it from cache)
       */
      shareReplay({ bufferSize: 1, refCount: true }),
      takeUntil(this.destroySubject),
      (source) => {
        return new Observable<ObservedValueOf<typeof this.state$>>(
          (observer) => {
            this.observerCount.next(this.observerCount.getValue() + 1)
            const sub = source.subscribe(observer)

            return () => {
              this.observerCount.next(this.observerCount.getValue() - 1)
              sub.unsubscribe()
            }
          }
        )
      }
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

  createMutation(variables: TVariables) {
    type LocalState = MutationState<TData, TError, TVariables, TContext>

    const isPaused = this.state.isPaused

    const defaultFn = async () =>
      await Promise.reject(new Error("No mutationFn found"))

    const mutationFn = this.options.mutationFn ?? defaultFn

    const onCacheMutate$ = iif(
      () => isPaused,
      of(null),
      functionAsObservable(
        () =>
          this.mutationCache.config.onMutate?.(
            variables,
            this as Mutation<any, any, any>
          )
      )
    )

    const onOptionMutate$ = iif(
      () => isPaused,
      of(this.state.context),
      functionAsObservable(
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        () => this.options.onMutate?.(variables) ?? undefined
      )
    )

    const onMutate$ = onCacheMutate$.pipe(
      mergeMap(() => onOptionMutate$),
      share()
    )

    const queryRunner$ = onMutate$.pipe(
      switchMap((context) => {
        type QueryState = Omit<Partial<LocalState>, "data"> & {
          // add layer to allow undefined as mutation result
          result?: { data: TData }
        }

        const fn$ =
          typeof mutationFn === "function"
            ? // eslint-disable-next-line @typescript-eslint/promise-function-async
              functionAsObservable(() => mutationFn(variables))
            : mutationFn

        return fn$.pipe(
          map(
            (data): QueryState => ({
              result: {
                data
              },
              error: null,
              context
            })
          ),
          retryOnError<QueryState>({
            ...this.options,
            caughtError: (attempt, error) =>
              of({
                failureCount: attempt,
                failureReason: error
              }),
            catchError: (attempt, error) => {
              console.error(error)

              const onCacheError$ = functionAsObservable(
                () =>
                  this.mutationCache.config.onError?.<
                    TData,
                    TError,
                    TVariables,
                    TContext
                  >(error as Error, variables, context, this)
              )

              const onError$ = functionAsObservable(
                () =>
                  this.options.onError?.(error as TError, variables, context)
              )

              return concat(onCacheError$, onError$).pipe(
                toArray(),
                map(
                  (): QueryState => ({
                    failureCount: attempt,
                    result: undefined,
                    error: error as TError,
                    failureReason: error,
                    context
                  })
                )
              )
            }
          }),
          takeWhile(
            ({ result, error }) =>
              result?.data === undefined && error === undefined,
            true
          )
        )
      })
    )

    const initState$ = of({
      ...this.state,
      variables,
      status: "pending",
      isPaused: false,
      failureCount: 0,
      failureReason: null,
      submittedAt: this.state.submittedAt ?? new Date().getTime()
    } satisfies LocalState & Required<Pick<LocalState, "variables">>)

    const mutation$ = merge(
      initState$,
      onMutate$.pipe(map((context) => ({ context }))),
      queryRunner$.pipe(
        switchMap(({ result, error, ...restState }) => {
          if (!result && !error)
            return of({
              ...restState
            })

          const onCacheSuccess$ = error
            ? of(null)
            : functionAsObservable(
                () =>
                  this.mutationCache.config.onSuccess?.(
                    result?.data,
                    variables,
                    restState.context,
                    this as Mutation<any, any, any>
                  )
              )

          const onSuccess$ = error
            ? of(null)
            : functionAsObservable(
                () =>
                  this.options.onSuccess?.(
                    result?.data as TData,
                    variables,
                    restState.context
                  )
              )

          // to pass as option from cache not here
          const onCacheSettled$ = functionAsObservable(
            () =>
              this.mutationCache.config.onSettled?.(
                result?.data,
                error as any,
                variables,
                restState.context,
                this as Mutation<any, any, any>
              )
          )

          const onSettled$ = functionAsObservable(
            () =>
              this.options.onSettled?.(
                result?.data,
                error as TError,
                variables,
                restState.context
              )
          )

          const result$ = concat(
            onCacheSuccess$,
            onSuccess$,
            onCacheSettled$,
            onSettled$
          ).pipe(
            toArray(),
            map(() =>
              error
                ? ({
                    status: "error" as const,
                    error,
                    data: undefined,
                    variables,
                    ...restState
                  } satisfies Partial<LocalState>)
                : ({
                    status: "success" as const,
                    error,
                    data: result?.data,
                    variables,
                    ...restState
                  } satisfies Partial<LocalState>)
            )
          )

          return result$
        })
      )
    ).pipe(
      mergeResults,
      (this.options.__queryRunnerHook as typeof identity) ?? identity,
      takeUntil(this.destroySubject)
    )

    return mutation$
  }

  observeTillFinished() {
    return this.state$.pipe(
      takeWhile(
        (result) => result.status !== "error" && result.status !== "success",
        true
      )
    )
  }

  /**
   * @important
   * The resulting observable will complete as soon as the mutation
   * is over, unlike the state which can be re-subscribed later.
   */
  execute(variables: TVariables) {
    this.executeSubject.next(variables)
    this.executeSubject.complete()

    return this.observeTillFinished()
  }

  continue() {
    return this.execute(this.state.variables as TVariables)
  }

  destroy() {
    this.destroySubject.next()
    this.destroySubject.complete()
    this.executeSubject.complete()
  }

  reset() {
    this.resetSubject.next()
    this.resetSubject.complete()
    this.destroy()
  }
}
