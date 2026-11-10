import {
  type DefaultError,
  type QueryClient,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback } from "react"
import {
  catchError,
  defaultIfEmpty,
  first,
  fromEvent,
  ignoreElements,
  merge,
  of,
  switchMap,
  tap,
  throwError,
  timer,
} from "rxjs"
import { useRefOnce } from "../utils"
import { getRetryDelay, shouldRetry } from "../utils/retry"
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
type SwitchOverrides<TData, TError, TVariables, TOnMutateResult> = {
  [K in
    | "mutationFn"
    | "onMutate"
    | "onSuccess"
    | "onError"
    | "onSettled"
    | "retry"
    | "retryDelay"]: UseMutation$Options<
    TData | null,
    TError,
    SwitchVariables<TVariables>,
    TOnMutateResult
  >[K]
}

/**
 * The options the hook passes over the caller's. They replace the client's
 * defaults, so they are built from the options merged with those defaults.
 *
 * TanStack Query waits between two attempts with a timer that nothing outside
 * it can stop. So it gets a `retryDelay` of 0, and a failed attempt waits the
 * delay before it hands its error over, where a cancel ends the wait. TanStack
 * Query then checks, as after its own wait, that the device is online and the
 * page visible before it retries.
 */
function createSwitchOverrides<TData, TError, TVariables, TOnMutateResult>(
  client: QueryClient,
  {
    mutationFn,
    ...options
  }: UseMutation$Options<TData | null, TError, TVariables, TOnMutateResult>,
): SwitchOverrides<TData, TError, TVariables, TOnMutateResult> {
  const { onMutate, onSuccess, onError, onSettled, retry, retryDelay } =
    client.defaultMutationOptions(options)

  /**
   * Waits `retryDelay` when TanStack Query will retry the failure, and not at
   * all for the last one. The failures recorded on the call's mutation are the
   * attempt count TanStack Query will pass to `retry`. A call whose mutation
   * left the cache, through `MutationCache.clear()`, counts from 0.
   */
  const waitBeforeRetry = (
    call: SwitchVariables<TVariables>,
    error: TError,
  ) => {
    const failureCount =
      client
        .getMutationCache()
        .find<
          TData | null,
          TError,
          SwitchVariables<TVariables>,
          TOnMutateResult
        >({ predicate: (mutation) => mutation.state.variables === call })?.state
        .failureCount ?? 0

    const delay = shouldRetry(retry, failureCount, error)
      ? getRetryDelay(retryDelay, failureCount, error)
      : 0

    return delay > 0 ? timer(delay) : of(0)
  }

  return {
    mutationFn: (call: SwitchVariables<TVariables>) => {
      if (call.abort.aborted) {
        throw new SwitchMutationCancelError()
      }

      /**
       * `defaultIfEmpty` must sit on the source itself: the abort stream
       * never completes, so the merged stream never completes either and
       * a `defaultIfEmpty` placed after it would never fire — an empty
       * source would leave the mutation pending forever.
       */
      return merge(
        resolveMutationFnSource(mutationFn, call.variables).pipe(
          defaultIfEmpty(null),
          catchError((error: TError) =>
            waitBeforeRetry(call, error).pipe(
              switchMap(() => throwError(() => error)),
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
 * A cancelled call fails with `SwitchMutationCancelError` and is not retried:
 * at once while it runs or waits `retryDelay`, and on resuming when TanStack
 * Query holds it, such as while the device is offline.
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
