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
} from "rxjs"
import { retryOnError } from "../operators"
import { type MutationState, type MutationOptions } from "./types"
import { getDefaultMutationState } from "./defaultMutationState"
import { mergeResults } from "./operators"
import { type DefaultError } from "../types"
import { type MutationCache } from "./MutationCache"
import { functionAsObservable } from "../utils/functionAsObservable"

export class Mutation<
  Data = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> {
  state: MutationState<Data, TError, TVariables, TContext> =
    getDefaultMutationState<Data, TError, TVariables, TContext>()

  state$ = new BehaviorSubject(this.state)
  options: MutationOptions<Data, TError, TVariables, TContext>
  mutationCache: MutationCache
  cancelSubject = new Subject<void>()

  constructor({
    options,
    mutationCache
  }: {
    mutationCache: MutationCache
    options: MutationOptions<Data, TError, TVariables, TContext>
  }) {
    this.options = options
    this.mutationCache = mutationCache
  }

  execute(variables: TVariables) {
    type LocalState = MutationState<Data, TError, TVariables, TContext>

    const mutationFn = this.options.mutationFn

    const onMutate = functionAsObservable(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      () =>
        this.mutationCache.config.onMutate?.<
          Data,
          TError,
          TVariables,
          TContext
        >(variables, this) ??
        this.options.onMutate?.(variables) ??
        undefined
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

            this.mutationCache.config.onError?.<
              Data,
              TError,
              TVariables,
              TContext
            >(error as Error, variables, context, this)

            this.options.onError?.(error, variables)

            return of({ data: error, context, isError: true })
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
        map(({ data, isError, context }) => {
          if (!isError) {
            if (this.options.onSuccess != null)
              this.options.onSuccess(data as Data, variables)
          }

          return isError
            ? ({
                status: "error" as const,
                error: data as LocalState["error"],
                data: undefined,
                context
              } satisfies Partial<LocalState>)
            : ({
                status: "success" as const,
                error: null,
                data: data as Data,
                context
              } satisfies Partial<LocalState>)
        })
      )
    ).pipe(
      mergeResults,
      tap((value) => {
        this.state = { ...this.state, ...value }
        this.state$.next(this.state)

        if (value.status === "error" || value.status === "success") {
          const onSettled = () =>
            this.mutationCache.config.onSettled?.(
              value.data,
              value.error as any,
              variables,
              value.context,
              this as Mutation<any, any, any>
            ) ??
            this.options.onSettled?.(
              value.data,
              value.error,
              variables,
              value.context
            ) ??
            {}

          onSettled()
        }
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
