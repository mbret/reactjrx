import { type NotifyEvent } from "../../mutations/cache/types"
import { type DefaultError } from "../../types"
import { type QueryObserver } from "../observer/QueryObserver"
import { type Query } from "../query/Query"
import { type Action } from "../query/types"

export interface QueryCacheConfig {
  onError?: (
    error: DefaultError,
    query: Query<unknown, unknown, unknown>
  ) => void
  onSuccess?: (data: unknown, query: Query<unknown, unknown, unknown>) => void
  onSettled?: (
    data: unknown | undefined,
    error: DefaultError | null,
    query: Query<unknown, unknown, unknown>
  ) => void
}

interface NotifyEventQueryAdded extends NotifyEvent {
  type: "added"
  query: Query<any, any, any, any>
}

interface NotifyEventQueryRemoved extends NotifyEvent {
  type: "removed"
  query: Query<any, any, any, any>
}

interface NotifyEventQueryUpdated extends NotifyEvent {
  type: "updated"
  query: Query<any, any, any, any>
  action: Action<any, any>
}

interface NotifyEventQueryObserverAdded extends NotifyEvent {
  type: "observerAdded"
  query: Query<any, any, any, any>
  observer: QueryObserver<any, any, any, any, any>
}

interface NotifyEventQueryObserverRemoved extends NotifyEvent {
  type: "observerRemoved"
  query: Query<any, any, any, any>
  observer: QueryObserver<any, any, any, any, any>
}

interface NotifyEventQueryObserverResultsUpdated extends NotifyEvent {
  type: "observerResultsUpdated"
  query: Query<any, any, any, any>
}

interface NotifyEventQueryObserverOptionsUpdated extends NotifyEvent {
  type: "observerOptionsUpdated"
  query: Query<any, any, any, any>
  observer: QueryObserver<any, any, any, any, any>
}

export type QueryCacheNotifyEvent =
  | NotifyEventQueryAdded
  | NotifyEventQueryRemoved
  | NotifyEventQueryUpdated
  | NotifyEventQueryObserverAdded
  | NotifyEventQueryObserverRemoved
  | NotifyEventQueryObserverResultsUpdated
  | NotifyEventQueryObserverOptionsUpdated

export type QueryCacheListener = (event: QueryCacheNotifyEvent) => void
