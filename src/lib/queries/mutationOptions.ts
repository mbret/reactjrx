import type { UseMutationOptions } from "@tanstack/react-query"
import type { Observable } from "rxjs"

/**
 * Resolves the public `mutationFn` option — an Observable or a function
 * returning one — to its source Observable for the given variables.
 */
export function resolveMutationFnSource<TData, TVariables>(
  mutationFn:
    | ((variables: TVariables) => Observable<TData>)
    | Observable<TData>,
  variables: TVariables,
) {
  return typeof mutationFn === "function" ? mutationFn(variables) : mutationFn
}

type MutationCallbacks<TData, TError, TVariables, TOnMutateResult> = Pick<
  UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
  "onMutate" | "onSuccess" | "onError" | "onSettled"
>

/**
 * Same callbacks, but keyed as required so that spreading the adapted
 * callbacks after `...options` overrides (rather than unions with) the
 * raw-variables callbacks still present in `options`.
 */
type AdaptedMutationCallbacks<TData, TError, TVariables, TOnMutateResult> = {
  [K in "onMutate" | "onSuccess" | "onError" | "onSettled"]:
    | MutationCallbacks<
        TData,
        TError,
        { variables: TVariables },
        TOnMutateResult
      >[K]
    | undefined
}

/**
 * Hooks built on top of `useMutation$` (`useSwitchMutation$`,
 * `useConcatMutation$`) run their inner mutation with the user variables
 * wrapped in an envelope (`{ variables, ... }`). This adapts the user-facing
 * callbacks, which expect the raw variables, to that envelope.
 */
export function adaptCallbacksToWrappedVariables<
  TData,
  TError,
  TVariables,
  TOnMutateResult,
>({
  onMutate,
  onSuccess,
  onError,
  onSettled,
}: MutationCallbacks<
  TData,
  TError,
  TVariables,
  TOnMutateResult
>): AdaptedMutationCallbacks<TData, TError, TVariables, TOnMutateResult> {
  return {
    onMutate: onMutate
      ? ({ variables }, ...rest) => onMutate(variables, ...rest)
      : undefined,
    onSuccess: (data, { variables }, ...rest) =>
      onSuccess?.(data, variables, ...rest),
    onError: (error, { variables }, ...rest) =>
      onError?.(error, variables, ...rest),
    onSettled: (data, error, { variables }, ...rest) =>
      onSettled?.(data, error, variables, ...rest),
  }
}
