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
    onMutate,
    onError,
    onSettled,
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

          const source =
            typeof mutationFn === "function"
              ? mutationFn(variables)
              : mutationFn

          return merge(
            source,
            fromEvent(abort, "abort").pipe(
              tap(() => {
                throw new SwitchMutationCancelError()
              }),
              ignoreElements(),
            ),
          ).pipe(first(), defaultIfEmpty(null))
        },
        [mutationFn],
      ),
      onMutate: onMutate
        ? ({ variables }, ...rest) => {
            return onMutate(variables, ...rest)
          }
        : undefined,
      onSuccess: (data, { variables }, ...rest) => {
        return options.onSuccess?.(data, variables, ...rest)
      },
      onError: (error, { variables }, ...rest) => {
        return onError?.(error, variables, ...rest)
      },
      onSettled: (data, error, { variables }, ...rest) => {
        return onSettled?.(data, error, variables, ...rest)
      },
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
