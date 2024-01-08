import { type DefaultError } from "../../types"
import { type Mutation } from "../mutation/Mutation"
import { type MutationObserver } from "../observers/MutationObserver"

export interface MutationCacheConfig {
  onError?: <
    Data = unknown,
    TError = DefaultError,
    TVariables = void,
    TContext = unknown
  >(
    error: DefaultError,
    variables: unknown,
    context: unknown,
    mutation: Mutation<Data, TError, TVariables, TContext>
  ) => Promise<unknown> | unknown
  onSuccess?: (
    data: unknown,
    variables: unknown,
    context: unknown,
    mutation: Mutation<unknown, unknown, unknown>
  ) => Promise<unknown> | unknown
  onMutate?: (
    variables: unknown,
    mutation: Mutation<unknown, unknown, unknown>
  ) => Promise<unknown> | unknown
  onSettled?: (
    data: unknown | undefined,
    error: DefaultError | null,
    variables: unknown,
    context: unknown,
    mutation: Mutation<unknown, unknown, unknown>
  ) => Promise<unknown> | unknown
}

export type NotifyEventType =
  | "added"
  | "removed"
  | "updated"
  | "observerAdded"
  | "observerRemoved"
  | "observerResultsUpdated"
  | "observerOptionsUpdated"

export interface NotifyEvent {
  type: NotifyEventType
}

interface FailedAction<TError> {
  type: "failed"
  failureCount: number
  error: TError | null
}

interface PendingAction<TVariables, TContext> {
  type: "pending"
  variables?: TVariables
  context?: TContext
}

interface SuccessAction<TData> {
  type: "success"
  data: TData
}

interface ErrorAction<TError> {
  type: "error"
  error: TError
}

interface PauseAction {
  type: "pause"
}

interface ContinueAction {
  type: "continue"
}

export type Action<TData, TError, TVariables, TContext> =
  | ContinueAction
  | ErrorAction<TError>
  | FailedAction<TError>
  | PendingAction<TVariables, TContext>
  | PauseAction
  | SuccessAction<TData>

interface NotifyEventMutationAdded extends NotifyEvent {
  type: "added"
  mutation: Mutation<any, any, any, any>
}
interface NotifyEventMutationRemoved extends NotifyEvent {
  type: "removed"
  mutation: Mutation<any, any, any, any>
}

interface NotifyEventMutationObserverAdded extends NotifyEvent {
  type: "observerAdded"
  mutation: Mutation<any, any, any, any>
  observer: MutationObserver<any, any, any>
}

interface NotifyEventMutationObserverRemoved extends NotifyEvent {
  type: "observerRemoved"
  mutation: Mutation<any, any, any, any>
  observer: MutationObserver<any, any, any>
}

interface NotifyEventMutationObserverOptionsUpdated extends NotifyEvent {
  type: "observerOptionsUpdated"
  mutation?: Mutation<any, any, any, any>
  observer: MutationObserver<any, any, any, any>
}

interface NotifyEventMutationUpdated extends NotifyEvent {
  type: "updated"
  mutation: Mutation<any, any, any, any>
  action: Action<any, any, any, any>
}

export type MutationCacheNotifyEvent =
  | NotifyEventMutationAdded
  | NotifyEventMutationRemoved
  | NotifyEventMutationObserverAdded
  | NotifyEventMutationObserverRemoved
  | NotifyEventMutationObserverOptionsUpdated
  | NotifyEventMutationUpdated
