import {
  map,
  merge,
  of,
  tap,
  switchMap,
  Subject,
  takeUntil,
  type Observable,
  shareReplay,
  takeWhile,
  BehaviorSubject,
  concat
} from "rxjs"
import { getDefaultMutationState } from "../defaultMutationState"
import { type DefaultError } from "../../types"
import { type MutationCache } from "../cache/MutationCache"
import { functionAsObservable } from "../../utils/functionAsObservable"
import {
  type MutationState,
  type MutationMeta,
  type MutationOptions
} from "./types"
import { executeMutation } from "./executeMutation"
import { trackSubscriptions } from "../../../../utils/operators/trackSubscriptions"

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
  public destroyed$ = this.destroySubject.asObservable()

  constructor({
    options,
    mutationCache,
    state
  }: MutationConfig<TData, TError, TVariables, TContext>) {
    this.options = options
    this.mutationCache = mutationCache
    this.state = state ?? this.state

    const initialState$ = of(this.state)
    const resetState$ = this.resetSubject.pipe(
      map(() => getDefaultMutationState<TData, TError, TVariables, TContext>())
    )
    const execution$ = this.executeSubject.pipe(
      switchMap((variables) =>
        executeMutation({
          mutation: this,
          mutationCache: this.mutationCache,
          options: {
            ...this.options,
            // @todo test onError, onSettled
            onSuccess: (data, variables, context) => {
              const onCacheSuccess$ = functionAsObservable(
                () =>
                  mutationCache.config.onSuccess?.(
                    data,
                    variables,
                    context,
                    this as Mutation<any, any, any, any>
                  )
              )

              const onOptionSuccess$ = functionAsObservable(
                () => this.options.onSuccess?.(data, variables, context)
              )

              return concat(onCacheSuccess$, onOptionSuccess$)
            }
          },
          state: this.state,
          variables
        })
      ),
      tap((value) => {
        this.state = { ...this.state, ...value }
      }),
      takeUntil(this.destroySubject)
    )

    this.state$ = merge(initialState$, execution$, resetState$).pipe(
      /**
       * refCount as true somewhat make NEVER complete when there are
       * no more observers. I thought I should have to complete manually (which is
       * why we still cancel the observable when we remove it from cache)
       */
      shareReplay({ bufferSize: 1, refCount: true }),
      takeUntil(this.destroySubject),
      trackSubscriptions((count) => {
        this.observerCount.next(count)
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
