import {
  type MutationObserverOptions,
  type MutationObserverResult
} from "../../client/mutations/observers/types"
import { type MutateFunction } from "../../client/mutations/types"
import { type DefaultError } from "../../client/types"

type Override<A, B> = { [K in keyof A]: K extends keyof B ? B[K] : A[K] }

export type UseMutateFunction<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> = (
  ...args: Parameters<MutateFunction<TData, TError, TVariables, TContext>>
) => void

export interface UseMutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends Omit<
    MutationObserverOptions<TData, TError, TVariables, TContext>,
    "_defaulted" | "variables"
  > {
  cancelOnUnMount?: boolean
}

export type UseMutateAsyncFunction<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> = MutateFunction<TData, TError, TVariables, TContext>

export type UseBaseMutationResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TContext = unknown
> = Override<
  MutationObserverResult<TData, TError, TVariables, TContext>,
  { mutate: UseMutateFunction<TData, TError, TVariables, TContext> }
> & { mutateAsync: UseMutateAsyncFunction<TData, TError, TVariables, TContext> }

export type UseMutationResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TContext = unknown
> = UseBaseMutationResult<TData, TError, TVariables, TContext>
