import {
  map,
  merge,
  of,
  switchMap,
  concat,
  toArray,
  takeWhile,
  iif,
  catchError,
  scan,
  shareReplay,
  isEmpty,
  tap,
  share,
  ignoreElements
} from "rxjs"
import { type MutationOptions, type MutationState } from "./types"
import { makeObservable } from "../../utils/makeObservable"
import { type DefaultError } from "../../types"
import { getDefaultMutationState } from "../utils/defaultMutationState"
import { onlineManager } from "../../onlineManager"
import { waitForNetworkOnError } from "./waitForNetworkOnError"
import { delayWhenNetworkOnline } from "./delayWhenNetworkOnline"
import { retryBackoff } from "../../../../utils/operators/retryBackoff"

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

  const onMutateFactory = () => options.onMutate?.(variables) ?? undefined

  const contextFromOnMutate$ = makeObservable(onMutateFactory)

  contextFromOnMutate$.pipe(
    tap((context) => {
      if (context === undefined) {
        throw new Error("onMutate returned undefined")
      }
    })
  )
  const rawContext$ = of(state.context)

  const context$ = iif(() => isPaused, rawContext$, contextFromOnMutate$).pipe(
    shareReplay(1)
  )

  type QueryState = Omit<Partial<LocalState>, "data"> & {
    // add layer to allow undefined as mutation result
    result?: { data: TData }
  }

  const onError = (error: TError, context: TContext, attempt: number) => {
    const onError$ = makeObservable(() =>
      options.onError?.(error, variables, context)
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

  const queryRunner$ = context$.pipe(
    switchMap((context) => {
      const fn$ =
        typeof mutationFn === "function"
          ? makeObservable(() => mutationFn(variables))
          : mutationFn

      const sharedFn$ = fn$.pipe(share())

      const completeWithoutValue$ = sharedFn$.pipe(
        isEmpty(),
        tap((isEmppty) => {
          if (isEmppty) {
            throw new Error("Mutation completed without any emission (EMPTY)")
          }
        }),
        ignoreElements()
      )

      const finalFn$ = merge(sharedFn$, completeWithoutValue$).pipe(
        map(
          (data): QueryState => ({
            result: {
              data
            },
            error: null,
            context
          })
        ),
        waitForNetworkOnError,
        retryBackoff({
          ...options,
          retry: (attempt, error) => {
            const retry = options.retry ?? 0
            if (typeof retry === "function") return retry(attempt, error)
            if (typeof retry === "boolean") return retry

            return attempt < retry
          },
          caughtError: (attempt, error) =>
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            of({
              failureCount: attempt,
              failureReason: error
            } as QueryState),
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

      if (
        onlineManager.isOnline() ||
        options.networkMode === "offlineFirst" ||
        options.networkMode === "always"
      ) {
        return finalFn$
      } else {
        return finalFn$.pipe(delayWhenNetworkOnline())
      }
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
    context$.pipe(map((context) => ({ context }) as Partial<LocalState>)),
    queryRunner$.pipe(
      switchMap(({ result: mutationData, error, ...restState }) => {
        if (!mutationData && !error)
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return of({
            ...restState
          } as Partial<LocalState>)

        const success$ = error
          ? of(null)
          : makeObservable(() =>
              options.onSuccess?.(
                mutationData?.data as TData,
                variables,
                restState.context
              )
            )

        const onOptionSettled$ = makeObservable(() =>
          options.onSettled?.(
            mutationData?.data,
            error as TError,
            variables,
            restState.context
          )
        )

        const settled$ = onOptionSettled$.pipe(
          catchError((error) => (mutationData ? of(mutationData) : of(error)))
        )

        const result$ = concat(success$, settled$).pipe(
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
                  failureCount: 0,
                  failureReason: null,
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
    }, getDefaultMutationState<TData, TError, TVariables, TContext>())
  )

  return mutation$
}
