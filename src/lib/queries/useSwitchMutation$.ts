import {
  type DefaultError,
  type QueryClient,
  type UseMutationOptions,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback } from "react"
import {
  defaultIfEmpty,
  first,
  fromEvent,
  ignoreElements,
  merge,
  of,
  switchMap,
  tap,
  timer,
} from "rxjs"
import { useRefOnce } from "../utils"
import { shouldRetry } from "../utils/shouldRetry"
import { resolveMutationFnSource } from "./mutationOptions"
import { type UseMutation$Options, useMutation$ } from "./useMutation$"

export class SwitchMutationCancelError extends Error {
  constructor(message = "Mutation canceled") {
    super(message)
    this.name = "SwitchMutationCancelError"
  }
}

type SwitchVariables<TVariables> = {
  variables: TVariables
  abort: AbortSignal
}

/**
 * Each member of TanStack's result, with `variables` holding the variables
 * given to `mutate` instead of the `{ variables, abort }` the hook runs with.
 */
type WithCallerVariables<TResult, TVariables> = TResult extends {
  variables: infer TResultVariables
}
  ? Omit<TResult, "variables"> & {
      variables: TResultVariables extends SwitchVariables<TVariables>
        ? TVariables
        : undefined
    }
  : never

/**
 * Keyed as required, so that spreading them after the caller's options
 * replaces the caller's options of the same name.
 */
type SwitchOverrides<TData, TError, TVariables, TOnMutateResult> = Pick<
  UseMutation$Options<
    TData | null,
    TError,
    SwitchVariables<TVariables>,
    TOnMutateResult
  >,
  "mutationFn"
> & {
  [K in
    | "onMutate"
    | "onSuccess"
    | "onError"
    | "onSettled"
    | "retry"
    | "retryDelay"]: UseMutationOptions<
    TData | null,
    TError,
    SwitchVariables<TVariables>,
    TOnMutateResult
  >[K]
}

/**
 * TanStack Query's default `retryDelay`, which it does not export.
 */
const defaultRetryDelay = (failureCount: number) =>
  Math.min(1000 * 2 ** failureCount, 30_000)

/**
 * The options the hook passes over the caller's: a `mutationFn` that stops
 * when its call is cancelled, the callbacks, adapted to the
 * `{ variables, abort }` the hook runs the mutation with, and a `retry` that
 * never retries a cancelled call. They replace the client's defaults, so they
 * are built from the options merged with those defaults.
 *
 * TanStack Query waits between two attempts with a timer that nothing outside
 * it can stop. So it gets a `retryDelay` of 0, and each attempt first waits
 * the delay itself, where a cancel ends the wait.
 */
function createSwitchOverrides<TData, TError, TVariables, TOnMutateResult>(
  client: QueryClient,
  {
    mutationFn,
    ...options
  }: UseMutation$Options<TData | null, TError, TVariables, TOnMutateResult>,
): SwitchOverrides<TData, TError, TVariables, TOnMutateResult> {
  const {
    onMutate,
    onSuccess,
    onError,
    onSettled,
    retry,
    retryDelay = defaultRetryDelay,
  } = client.defaultMutationOptions(options)

  /**
   * The `retryDelay` of the failure that this attempt of the call retries, or
   * 0 for its first attempt. TanStack Query records the failure in the call's
   * mutation before it retries.
   */
  const getRetryDelay = (call: SwitchVariables<TVariables>) => {
    const state = client
      .getMutationCache()
      .find<TData | null, TError, SwitchVariables<TVariables>, TOnMutateResult>(
        { predicate: (mutation) => mutation.state.variables === call },
      )?.state

    if (!state || state.failureReason === null) return 0

    return typeof retryDelay === "function"
      ? retryDelay(state.failureCount - 1, state.failureReason)
      : retryDelay
  }

  return {
    mutationFn: (call: SwitchVariables<TVariables>) => {
      if (call.abort.aborted) {
        throw new SwitchMutationCancelError()
      }

      const delay = getRetryDelay(call)

      /**
       * `defaultIfEmpty` must sit on the source itself: the abort stream
       * never completes, so the merged stream never completes either and
       * a `defaultIfEmpty` placed after it would never fire — an empty
       * source would leave the mutation pending forever.
       */
      return merge(
        (delay > 0 ? timer(delay) : of(0)).pipe(
          switchMap(() =>
            resolveMutationFnSource(mutationFn, call.variables).pipe(
              defaultIfEmpty(null),
            ),
          ),
        ),
        fromEvent(call.abort, "abort").pipe(
          tap(() => {
            throw new SwitchMutationCancelError()
          }),
          ignoreElements(),
        ),
      ).pipe(first())
    },
    onMutate:
      onMutate && (({ variables }, ...rest) => onMutate(variables, ...rest)),
    onSuccess:
      onSuccess &&
      ((data, { variables }, ...rest) => onSuccess(data, variables, ...rest)),
    onError:
      onError &&
      ((error, { variables }, ...rest) => onError(error, variables, ...rest)),
    onSettled:
      onSettled &&
      ((data, error, { variables }, ...rest) =>
        onSettled(data, error, variables, ...rest)),
    retry: (failureCount, error) =>
      !(error instanceof SwitchMutationCancelError) &&
      shouldRetry(retry, failureCount, error),
    retryDelay: 0,
  }
}

/**
 * Runs a mutation, and cancels the call still running when a new one starts.
 * A cancelled call fails at once with `SwitchMutationCancelError`, also while
 * it waits to be retried, and is not retried.
 *
 * The callbacks, the client's defaults included, receive the variables given
 * to `mutate`, and `result.variables` holds them. A `MutationCache` and
 * `useMutationState` see the `{ variables, abort }` the hook runs the
 * mutation with.
 */
export function useSwitchMutation$<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  options: UseMutation$Options<
    TData | null,
    TError,
    TVariables,
    TOnMutateResult
  >,
  queryClient?: QueryClient,
) {
  const previousMutationCancelRef = useRefOnce(() => new AbortController())
  type TDataOrNull = TData | null

  const client = useQueryClient(queryClient)

  const { mutate, mutateAsync, ...rest } = useMutation$<
    TDataOrNull,
    TError,
    SwitchVariables<TVariables>,
    TOnMutateResult
  >(
    {
      ...options,
      ...createSwitchOverrides(client, options),
    },
    client,
  )

  const replaceRunningCall = useCallback(
    (variables: TVariables): SwitchVariables<TVariables> => {
      previousMutationCancelRef.current.abort()
      previousMutationCancelRef.current = new AbortController()

      return { variables, abort: previousMutationCancelRef.current.signal }
    },
    [previousMutationCancelRef],
  )

  const mutateSwitch = useCallback(
    (variables: TVariables) => mutate(replaceRunningCall(variables)),
    [mutate, replaceRunningCall],
  )

  const mutateAsyncSwitch = useCallback(
    (variables: TVariables) => mutateAsync(replaceRunningCall(variables)),
    [mutateAsync, replaceRunningCall],
  )

  /**
   * TanStack's result is a union by status, and TypeScript cannot follow a
   * swap of `variables` through each member. The swap keeps the member, so the
   * conditional type holds.
   */
  return {
    ...rest,
    variables: rest.variables?.variables,
    mutate: mutateSwitch,
    mutateAsync: mutateAsyncSwitch,
  } as WithCallerVariables<typeof rest, TVariables> & {
    mutate: typeof mutateSwitch
    mutateAsync: typeof mutateAsyncSwitch
  }
}
