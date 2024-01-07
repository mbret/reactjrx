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
  iif,
  catchError
} from "rxjs"
import { retryOnError } from "../operators"
import {
  type MutationState,
  type MutationOptions,
  type MutationMeta
} from "./types"
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
  protected mutationCache: MutationCache
  protected observerCount = new BehaviorSubject(0)
  protected destroySubject = new Subject<void>()
  protected resetSubject = new Subject<void>()
  protected executeSubject = new Subject<TVariables>()

  public state: MutationState<TData, TError, TVariables, TContext> =
    getDefaultMutationState<TData, TError, TVariables, TContext>()

  public state$: Observable<typeof this.state>
  public options: MutationOptions<TData, TError, TVariables, TContext>
  public observerCount$ = this.observerCount.asObservable()

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

    type QueryState = Omit<Partial<LocalState>, "data"> & {
      // add layer to allow undefined as mutation result
      result?: { data: TData }
    }

    const onError = (error: TError, context: TContext, attempt: number) => {
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
        () => this.options.onError?.(error, variables, context)
      )

      return concat(onCacheError$, onError$).pipe(
        catchError(() => of(error)),
        toArray(),
        map(
          (): QueryState => ({
            failureCount: attempt,
            result: undefined,
            error,
            failureReason: error,
            context,
            status: "error"
          })
        )
      )
    }

    const queryRunner$ = onMutate$.pipe(
      switchMap((context) => {
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
            catchError: (attempt, error) =>
              onError(error, context as TContext, attempt)
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
        switchMap(({ result: mutationData, error, ...restState }) => {
          if (!mutationData && !error)
            return of({
              ...restState
            })

          const onCacheSuccess$ = error
            ? of(null)
            : functionAsObservable(
                () =>
                  this.mutationCache.config.onSuccess?.(
                    mutationData?.data,
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
                    mutationData?.data as TData,
                    variables,
                    restState.context
                  )
              )

          // to pass as option from cache not here
          const onCacheSettled$ = functionAsObservable(
            () =>
              this.mutationCache.config.onSettled?.(
                mutationData?.data,
                error as any,
                variables,
                restState.context,
                this as Mutation<any, any, any>
              )
          )

          const onOptionSettled$ = functionAsObservable(
            () =>
              this.options.onSettled?.(
                mutationData?.data,
                error as TError,
                variables,
                restState.context
              )
          )

          const onSettled$ = concat(onCacheSettled$, onOptionSettled$).pipe(
            catchError((error) => (mutationData ? of(mutationData) : of(error)))
          )

          const result$ = concat(onCacheSuccess$, onSuccess$, onSettled$).pipe(
            toArray(),
            map(() =>
              error
                ? ({
                    error,
                    data: undefined,
                    variables,
                    ...restState
                  } satisfies Partial<LocalState>)
                : ({
                    status: "success" as const,
                    error,
                    data: mutationData?.data,
                    variables,
                    ...restState
                  } satisfies Partial<LocalState>)
            ),
            catchError((error) =>
              onError(error, restState.context as TContext, 0)
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

  get destroyed$() {
    return this.destroySubject.asObservable()
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
