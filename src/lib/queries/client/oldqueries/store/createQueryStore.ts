import {
  BehaviorSubject,
  type Observable,
  distinctUntilChanged,
  filter,
  Subject,
  map
} from "rxjs"
import { type QueryKey } from "../../keys/types"
import { isDefined } from "../../../../utils/isDefined"
import { shallowEqual } from "../../../../utils/shallowEqual"
import { createDebugger } from "./debugger"
import { type QueryTrigger, type QueryOptions } from "../../types"

export interface StoreObject<T = unknown> {
  queryKey: QueryKey
  isStale?: boolean
  lastFetchedAt?: number
  /**
   * runners push themselves so we can retrieve various
   * options, fn, etc on global listener.
   * Each query runs on its own individual context so they
   * have to register/deregister themselves into the global context.
   */
  runners: Array<Observable<{ options: QueryOptions<T> }>>
  cache_fnResult?: undefined | { result: T }
  deduplication_fn?: Observable<T>
}

export type QueryEvent =
  | {
      type: "fetchSuccess"
      key: string
    }
  | {
      type: "fetchError"
      key: string
    }
  | {
      type: "queryDataSet"
      key: string
    }

export interface QueryTriggerEvent {
  key: string
  trigger: QueryTrigger
}

export type QueryStore = ReturnType<typeof createQueryStore>

export const createQueryStore = () => {
  const store = new Map<string, BehaviorSubject<StoreObject>>()
  const store$ = new BehaviorSubject(store)
  const queryEventSubject = new Subject<QueryEvent>()
  const queryTriggerSubject = new Subject<QueryTriggerEvent>()

  const notify = () => {
    store$.next(store)
  }

  const setValue = (key: string, value: StoreObject) => {
    store.set(key, new BehaviorSubject(value))

    notify()
  }

  const getValue = <T>(serializedKey: string) => {
    return store.get(serializedKey)?.getValue() as StoreObject<T> | undefined
  }

  const getValue$ = (key: string) => {
    return store$.pipe(
      map(() => store.get(key)),
      filter(isDefined),
      map((entry) => entry.getValue()),
      distinctUntilChanged(shallowEqual)
    )
  }

  const updateValue = <T>(
    key: string,
    value: Partial<StoreObject<T>> | ((value: StoreObject<T>) => StoreObject<T>)
  ) => {
    const existingObject = store.get(key) as
      | BehaviorSubject<StoreObject<T>>
      | undefined

    if (!existingObject) return

    if (typeof value === "function") {
      existingObject.next({
        ...existingObject.getValue(),
        ...value(existingObject.getValue())
      })
    } else {
      existingObject.next({ ...existingObject.getValue(), ...value })
    }
    store$.next(store)
  }

  const updateMany = (
    value: Partial<StoreObject>,
    predicate: (storeObject: StoreObject) => boolean = () => true
  ) => {
    store.forEach((oldValue$) => {
      const oldValue = oldValue$.getValue()
      if (predicate(oldValue)) {
        oldValue$.next({ ...oldValue, ...value })
      }
    })

    store$.next(store)
  }

  const deleteValue = (key: string) => {
    store.delete(key)
    store$.next(store)
  }

  const addRunner = <T>(
    key: string,
    stream: StoreObject<T>["runners"][number]
  ) => {
    updateValue<T>(key, (old) => ({
      ...old,
      runners: [...old.runners, stream]
    }))

    return () => {
      const newListeners =
        store
          .get(key)
          ?.getValue()
          .runners.filter((reference) => reference !== stream) ?? []

      updateValue(key, (old) => ({
        ...old,
        runners: newListeners
      }))
    }
  }

  const start = () => {
    const debugger$ = createDebugger(store$)

    return () => {
      debugger$.unsubscribe()
    }
  }

  return {
    set: setValue,
    get: getValue,
    get$: getValue$,
    delete: deleteValue,
    update: updateValue,
    keys: () => store.keys(),
    updateMany,
    addRunner,
    store$,
    queryEvent$: queryEventSubject.asObservable(),
    dispatchQueryEvent: (event: QueryEvent) => {
      queryEventSubject.next(event)
    },
    queryTrigger$: queryTriggerSubject.asObservable(),
    dispatchQueryTrigger: (event: QueryTriggerEvent) => {
      queryTriggerSubject.next(event)
    },
    size: () => store.size,
    start
  }
}
