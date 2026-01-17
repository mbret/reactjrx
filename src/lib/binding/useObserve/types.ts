import type { ObservableStoreOptions, State } from "./store"

export interface UseObserveResult<Value, DefaultValue, Error = unknown>
  extends State<Value, DefaultValue, Error> {}

export interface UseObserveOptions<T, DefaultValue>
  extends Partial<ObservableStoreOptions<T, DefaultValue>> {}
