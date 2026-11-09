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
  tap,
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
 * Keyed as required, so that spreading them after the caller's options
 * replaces the caller's callbacks, which take the raw variables.
 */
type SwitchOverrides<TData, TError, TVariables, TOnMutateResult> = {
  [K in
    | "onMutate"
    | "onSuccess"
    | "onError"
    | "onSettled"
    | "retry"]: UseMutationOptions<
    TData,
    TError,
    SwitchVariables<TVariables>,
    TOnMutateResult
  >[K]
}

/**
 * The options the hook passes over the caller's: the callbacks, adapted to
 * the `{ variables, abort }` the hook runs the mutation with, and a `retry`
 * that never retries a cancelled call. They replace the client's defaults,
 * so they are built from the options merged with those defaults.
 */
function createSwitchOverrides<TData, TError, TVariables, TOnMutateResult>(
  client: QueryClient,
  options: Omit<
    UseMutation$Options<TData, TError, TVariables, TOnMutateResult>,
    "mutationFn"
  >,
): SwitchOverrides<TData, TError, TVariables, TOnMutateResult> {
  const { onMutate, onSuccess, onError, onSettled, retry } =
    client.defaultMutationOptions(options)

  return {
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
  }
}

/**
 * Runs a mutation, and cancels the call still running when a new one starts.
 * A cancelled call fails with `SwitchMutationCancelError` and is not retried.
 * A call cancelled while TanStack waits to retry it settles once that wait
 * ends.
 *
 * The callbacks, the client's defaults included, receive the variables given
 * to `mutate`. A `MutationCache`, `result.variables` and `useMutationState`
 * see the `{ variables, abort }` the hook runs the mutation with.
 */
export function useSwitchMutation$<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  {
    mutationFn,
    ...options
  }: UseMutation$Options<TData | null, TError, TVariables, TOnMutateResult>,
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
      mutationFn: useCallback(
        ({ variables, abort }: SwitchVariables<TVariables>) => {
          if (abort.aborted) {
            throw new SwitchMutationCancelError()
          }

          const source = resolveMutationFnSource(mutationFn, variables)

          /**
           * `defaultIfEmpty` must sit on the source itself: the abort stream
           * never completes, so the merged stream never completes either and
           * a `defaultIfEmpty` placed after it would never fire — an empty
           * source would leave the mutation pending forever.
           */
          return merge(
            source.pipe(defaultIfEmpty(null)),
            fromEvent(abort, "abort").pipe(
              tap(() => {
                throw new SwitchMutationCancelError()
              }),
              ignoreElements(),
            ),
          ).pipe(first())
        },
        [mutationFn],
      ),
      ...createSwitchOverrides(client, options),
    },
    client,
  )

  const mutateSwitch = useCallback(
    (variables: TVariables) => {
      previousMutationCancelRef.current.abort()
      previousMutationCancelRef.current = new AbortController()

      return mutate({
        variables,
        abort: previousMutationCancelRef.current.signal,
      })
    },
    [mutate, previousMutationCancelRef],
  )

  const mutateAsyncSwitch = useCallback(
    (variables: TVariables) => {
      previousMutationCancelRef.current.abort()
      previousMutationCancelRef.current = new AbortController()

      return mutateAsync({
        variables,
        abort: previousMutationCancelRef.current.signal,
      })
    },
    [mutateAsync, previousMutationCancelRef],
  )

  return { ...rest, mutate: mutateSwitch, mutateAsync: mutateAsyncSwitch }
}
