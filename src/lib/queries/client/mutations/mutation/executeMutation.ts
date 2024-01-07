import {
  map,
  merge,
  of,
  switchMap,
  concat,
  toArray,
  takeWhile,
  share,
  iif,
  catchError,
  scan,
  distinctUntilChanged,
} from "rxjs"
import { type MutationOptions, type MutationState } from "./types"
import { functionAsObservable } from "../../utils/functionAsObservable"
import { retryOnError } from "../../operators"
import { type DefaultError } from "../../types"
import { getDefaultMutationState } from "../defaultMutationState"
import { shallowEqual } from "../../../../utils/shallowEqual"

export const executeMutation = <
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
>({
  variables,
  state,
  options
}: {
  variables: TVariables
  state: MutationState<TData, TError, TVariables, TContext>
  options: MutationOptions<TData, TError, TVariables, TContext>
}) => {
  type LocalState = MutationState<TData, TError, TVariables, TContext>

  const isPaused = state.isPaused

  const defaultFn = async () =>
    await Promise.reject(new Error("No mutationFn found"))

  const mutationFn = options.mutationFn ?? defaultFn

  const onOptionMutate$ = iif(
    () => isPaused,
    of(state.context),
    functionAsObservable(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      () => options.onMutate?.(variables) ?? undefined
    )
  )

  const onMutate$ = onOptionMutate$.pipe(share())

  type QueryState = Omit<Partial<LocalState>, "data"> & {
    // add layer to allow undefined as mutation result
    result?: { data: TData }
  }

  const onError = (error: TError, context: TContext, attempt: number) => {
    console.error(error)

    const onError$ = functionAsObservable(
      () => options.onError?.(error, variables, context)
    )

    return onError$.pipe(
      catchError(() => of(error)),
      map(
        (): Omit<QueryState, "result"> => ({
          failureCount: attempt,
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
            onError(error, context as TContext, attempt).pipe(
              map((data) => ({
                ...data,
                result: undefined
              }))
            )
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    onMutate$.pipe(map((context) => ({ context }) as Partial<LocalState>)),
    queryRunner$.pipe(
      switchMap(({ result: mutationData, error, ...restState }) => {
        if (!mutationData && !error)
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return of({
            ...restState
          } as Partial<LocalState>)

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

        const onOptionSettled$ = functionAsObservable(
          () =>
            options.onSettled?.(
              mutationData?.data,
              error as TError,
              variables,
              restState.context
            )
        )

        const onSettled$ = onOptionSettled$.pipe(
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
            onError(error, restState.context as TContext, 0).pipe(
              map((data) => ({
                ...data,
                data: undefined
              }))
            )
          )
        )

        return result$
      })
    )
  ).pipe(
    scan((acc, current) => {
      return {
        ...acc,
        ...current,
        data: current.data ?? acc.data,
        error: current.error ?? acc.error
      }
    }, getDefaultMutationState<TData, TError, TVariables, TContext>()),
    distinctUntilChanged(
      ({ data: prevData, ...prev }, { data: currData, ...curr }) =>
        shallowEqual(prev, curr) && shallowEqual(prevData, currData)
    )
  )

  return mutation$
}
