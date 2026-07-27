import type { DefaultError, QueryClient } from "@tanstack/react-query"
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
import {
  adaptCallbacksToWrappedVariables,
  resolveMutationFnSource,
} from "./mutationOptions"
import { type UseMutation$Options, useMutation$ } from "./useMutation$"

export class SwitchMutationCancelError extends Error {
  constructor(message = "Mutation canceled") {
    super(message)
    this.name = "SwitchMutationCancelError"
  }
}

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

  const { mutate, mutateAsync, ...rest } = useMutation$<
    TDataOrNull,
    TError,
    { variables: TVariables; abort: AbortSignal },
    TOnMutateResult
  >(
    {
      ...options,
      mutationFn: useCallback(
        ({
          variables,
          abort,
        }: {
          variables: TVariables
          abort: AbortSignal
        }) => {
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
      ...adaptCallbacksToWrappedVariables(options),
    },
    queryClient,
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
