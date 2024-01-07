import {
  map,
  merge,
  of,
  switchMap,
  concat,
  toArray,
  mergeMap,
  takeWhile,
  share,
  iif,
  catchError
} from "rxjs"
import { type MutationOptions, type MutationState } from "./types"
import { functionAsObservable } from "../../utils/functionAsObservable"
import { retryOnError } from "../../operators"
import { type DefaultError } from "../../types"
import { mergeResults } from "../operators"
import { type Mutation } from "./Mutation"
import { type MutationCache } from "../cache/MutationCache"

export const executeMutation = <
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
>({
  variables,
  state,
  options,
  mutation,
  mutationCache
}: {
  variables: TVariables
  state: MutationState<TData, TError, TVariables, TContext>
  options: MutationOptions<TData, TError, TVariables, TContext>
  mutation: Mutation<TData, TError, TVariables, TContext>
  mutationCache: MutationCache
}) => {
  type LocalState = MutationState<TData, TError, TVariables, TContext>

  const isPaused = state.isPaused

  const defaultFn = async () =>
    await Promise.reject(new Error("No mutationFn found"))

  const mutationFn = options.mutationFn ?? defaultFn

  const onCacheMutate$ = iif(
    () => isPaused,
    of(null),
    functionAsObservable(
      () =>
        mutationCache.config.onMutate?.(
          variables,
          mutation as Mutation<any, any, any>
        )
    )
  )

  const onOptionMutate$ = iif(
    () => isPaused,
    of(state.context),
    functionAsObservable(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      () => options.onMutate?.(variables) ?? undefined
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
        mutationCache.config.onError?.<TData, TError, TVariables, TContext>(
          error as Error,
          variables,
          context,
          mutation
        )
    )

    const onError$ = functionAsObservable(
      () => options.onError?.(error, variables, context)
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
          ...options,
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
    ...state,
    variables,
    status: "pending",
    isPaused: false,
    failureCount: 0,
    failureReason: null,
    submittedAt: state.submittedAt ?? new Date().getTime()
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

        const onSuccess$ = error
          ? of(null)
          : functionAsObservable(
              () =>
                options.onSuccess?.(
                  mutationData?.data as TData,
                  variables,
                  restState.context
                )
            )

        // to pass as option from cache not here
        const onCacheSettled$ = functionAsObservable(
          () =>
            mutationCache.config.onSettled?.(
              mutationData?.data,
              error as any,
              variables,
              restState.context,
              mutation as Mutation<any, any, any>
            )
        )

        const onOptionSettled$ = functionAsObservable(
          () =>
            options.onSettled?.(
              mutationData?.data,
              error as TError,
              variables,
              restState.context
            )
        )

        const onSettled$ = concat(onCacheSettled$, onOptionSettled$).pipe(
          catchError((error) => (mutationData ? of(mutationData) : of(error)))
        )

        const result$ = concat(onSuccess$, onSettled$).pipe(
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
  ).pipe(mergeResults)

  return mutation$
}
