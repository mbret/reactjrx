/* eslint-disable @typescript-eslint/naming-convention */
import {
  catchError,
  identity,
  map,
  merge,
  of,
  take,
  tap,
  share,
  BehaviorSubject,
  switchMap,
  Subject,
  takeUntil,
  concat,
  toArray,
  mergeMap
} from "rxjs"
import { retryOnError } from "../operators"
import { type MutationState, type MutationOptions } from "./types"
import { getDefaultMutationState } from "./defaultMutationState"
import { mergeResults } from "./operators"
import { type DefaultError } from "../types"
import { type MutationCache } from "./MutationCache"
import { functionAsObservable } from "../utils/functionAsObservable"

export class Mutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> {
  state: MutationState<TData, TError, TVariables, TContext> =
    getDefaultMutationState<TData, TError, TVariables, TContext>()

  state$ = new BehaviorSubject(this.state)
  options: MutationOptions<TData, TError, TVariables, TContext>
  mutationCache: MutationCache
  cancelSubject = new Subject<void>()

  constructor({
    options,
    mutationCache
  }: {
    mutationCache: MutationCache
    options: MutationOptions<TData, TError, TVariables, TContext>
  }) {
    this.options = options
    this.mutationCache = mutationCache
  }

  execute(variables: TVariables) {
    type LocalState = MutationState<TData, TError, TVariables, TContext>

    const mutationFn = this.options.mutationFn

    const onCacheMutate$ = functionAsObservable(
      () =>
        this.mutationCache.config.onMutate?.(
          variables,
          this as Mutation<any, any, any>
        )
    )

    const onMutate = concat(
      onCacheMutate$.pipe(
        mergeMap(() => {
          const onMutate$ = functionAsObservable(
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            () => this.options.onMutate?.(variables) ?? undefined
          )

          return onMutate$
        })
      )
    )

    const queryRunner$ = onMutate.pipe(
      switchMap((context) => {
        const fn$ =
          typeof mutationFn === "function"
            ? // eslint-disable-next-line @typescript-eslint/promise-function-async
              functionAsObservable(() => mutationFn(variables))
            : mutationFn

        return fn$.pipe(
          retryOnError(this.options),
          take(1),
          map((data) => ({ data, context, isError: false })),
          catchError((error: unknown) => {
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
              () => this.options.onError?.(error as TError, variables, context)
            )

            return concat(onCacheError$, onError$).pipe(
              toArray(),
              map(() => ({ data: error, context, isError: true }))
            )
          })
        )
      })
    )

    const initState$ = of({
      ...this.state,
      variables,
      status: "pending",
      submittedAt: new Date().getTime()
    } satisfies LocalState & Required<Pick<LocalState, "variables">>)

    const mutation$ = merge(
      initState$,
      queryRunner$.pipe(
        switchMap(({ data: dataOrError, isError, context }) => {
          const error = (isError ? dataOrError : null) as TError
          const data = (isError ? undefined : dataOrError) as TData

          const onCacheSuccess$ = isError
            ? of(null)
            : functionAsObservable(
                () =>
                  this.mutationCache.config.onSuccess?.(
                    data,
                    variables,
                    context,
                    this as Mutation<any, any, any>
                  )
              )

          const onSuccess$ = isError
            ? of(null)
            : functionAsObservable(
                () => this.options.onSuccess?.(data, variables, context)
              )

          const onCacheSettled$ = functionAsObservable(
            () =>
              this.mutationCache.config.onSettled?.(
                data,
                error as any,
                variables,
                context,
                this as Mutation<any, any, any>
              )
          )

          const onSettled$ = functionAsObservable(
            () => this.options.onSettled?.(data, error, variables, context)
          )

          const result$ = concat(
            onCacheSuccess$,
            onSuccess$,
            onCacheSettled$,
            onSettled$
          ).pipe(
            toArray(),
            map(() =>
              isError
                ? ({
                    status: "error" as const,
                    error,
                    data,
                    context,
                    variables
                  } satisfies Partial<LocalState>)
                : ({
                    status: "success" as const,
                    error,
                    data,
                    context,
                    variables
                  } satisfies Partial<LocalState>)
            )
          )

          return result$
        })
      )
    ).pipe(
      mergeResults,
      tap((value) => {
        this.state = { ...this.state, ...value }
        this.state$.next(this.state)
      }),
      (this.options.__queryRunnerHook as typeof identity) ?? identity,
      takeUntil(this.cancelSubject),
      share()
    )

    return mutation$

    // return new Observable<ObservedValueOf<typeof mutation$>>((observer) => {
    //   const sub = mutation$.subscribe(observer)

    //   return () => {
    //     sub.unsubscribe()
    //   }
    // })
  }

  cancel() {
    this.cancelSubject.next()
  }
}
