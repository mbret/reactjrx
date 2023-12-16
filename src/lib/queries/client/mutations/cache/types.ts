import { type Mutation } from "../Mutation"
import { type MutationObserver } from "../observers/MutationObserver"

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
