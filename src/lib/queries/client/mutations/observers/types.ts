import { type DefaultError } from "../../types"
import {
  type MutationOptions,
  type MutationState,
  type MutationStatus
} from "../mutation/types"
import { type MutateFunction } from "../types"

export interface MutationObserverOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationOptions<TData, TError, TVariables, TContext> {
  throwOnError?: boolean | ((error: TError) => boolean)
}

export interface MutationObserverBaseResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationState<TData, TError, TVariables, TContext> {
  isError: boolean
  isIdle: boolean
  isPending: boolean
  isSuccess: boolean
  mutate: MutateFunction<TData, TError, TVariables, TContext>
  reset: () => void
}

export interface MutationObserverIdleResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationObserverBaseResult<TData, TError, TVariables, TContext> {
  data: undefined
  variables: undefined
  error: null
  isError: false
  isIdle: true
  isPending: false
  isSuccess: false
  status: "idle"
}

export interface MutationObserverLoadingResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationObserverBaseResult<TData, TError, TVariables, TContext> {
  data: undefined
  variables: TVariables
  error: null
  isError: false
  isIdle: false
  isPending: true
  isSuccess: false
  status: "pending"
}

export interface MutationObserverErrorResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationObserverBaseResult<TData, TError, TVariables, TContext> {
  data: undefined
  error: TError
  variables: TVariables
  isError: true
  isIdle: false
  isPending: false
  isSuccess: false
  status: "error"
}

export interface MutationObserverSuccessResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationObserverBaseResult<TData, TError, TVariables, TContext> {
  data: TData
  error: null
  variables: TVariables
  isError: false
  isIdle: false
  isPending: false
  isSuccess: true
  status: "success"
}

export interface MutationObserverAnyResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
> extends MutationObserverBaseResult<TData, TError, TVariables, TContext> {
  data: TData | undefined
  error: TError | null
  variables: TVariables
  isError: boolean
  isIdle: boolean
  isPending: boolean
  isSuccess: boolean
  status: MutationStatus
}

export type MutationObserverResult<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> = MutationObserverAnyResult<TData, TError, TVariables, TContext>
// | MutationObserverLoadingResult<TData, TError, TVariables, TContext>
// | MutationObserverErrorResult<TData, TError, TVariables, TContext>
// | MutationObserverSuccessResult<TData, TError, TVariables, TContext>
