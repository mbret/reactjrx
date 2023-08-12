import {
  BehaviorSubject,
  NEVER,
  distinctUntilChanged,
  filter,
  map,
  merge,
  mergeMap,
  of,
  pairwise,
  startWith,
  takeUntil,
  tap,
  withLatestFrom
} from "rxjs"
import { type QueryKey } from "../keys/types"
import { isDefined } from "../../../utils/isDefined"
import { shallowEqual } from "../../../utils/shallowEqual"
import { Logger } from "../../../logger"
import { difference } from "../../../utils/difference"
import { createDebugger } from "./debugger"

export interface StoreObject<T = unknown> {
  queryKey: QueryKey
  isStale: boolean
  lowestStaleTime?: number
  lastFetchedAt?: number
  queryCacheResult?: undefined | { result: T }
  listeners: number
}

export type QueryStore = ReturnType<typeof createQueryStore>

export const createQueryStore = () => {
  const store = new Map<string, BehaviorSubject<StoreObject>>()
  const store$ = new BehaviorSubject(store)

  const notify = () => {
    store$.next(store)
  }

  const setValue = (key: string, value: StoreObject) => {
    store.set(key, new BehaviorSubject(value))
    store$.next(store)
  }

  const getValue = (key: string) => {
    return store.get(key)?.getValue()
  }

  const getValue$ = (key: string) => {
    return store
      .get(key)
      ?.pipe(filter(isDefined), distinctUntilChanged(shallowEqual))
  }

  const updateValue = (
    key: string,
    value: Partial<StoreObject> | ((value: StoreObject) => StoreObject)
  ) => {
    const existingObject = store.get(key)

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

  const addListener = (key: string) => {
    updateValue(key, (old) => ({
      ...old,
      listeners: old.listeners + 1
    }))
  }

  const removeListener = (key: string) => {
    if ((store.get(key)?.getValue().listeners ?? 1) - 1 === 0) {
      store.delete(key)
      notify()
    } else {
      updateValue(key, (old) => ({
        ...old,
        listeners: old.listeners - 1
      }))
    }
  }

  const runner$ = store$.pipe(
    map((store) => [...store.keys()]),
    startWith([]),
    pairwise(),
    mergeMap(([previousKeys, currentKeys]) => {
      const newKeys = difference(currentKeys, previousKeys)

      return merge(
        ...newKeys.map((key) => {
          const deletedFromStore$ = store$.pipe(
            map(() => store.get(key)),
            filter((value) => value === undefined)
          )

          return merge(NEVER, of(null)).pipe(
            withLatestFrom(store$),
            tap(() => {
              console.log("QUERY", key, "in")
            }),
            tap({
              complete: () => {
                console.log("QUERY", key, "complete")
              }
            }),
            takeUntil(deletedFromStore$)
          )
        })
      )
    })
  )

  const queriesRunnerSub = runner$.subscribe()

  const debugger$ = createDebugger(store$)

  return {
    set: setValue,
    get: getValue,
    get$: getValue$,
    delete: deleteValue,
    update: updateValue,
    updateMany,
    removeListener,
    addListener,
    store$,
    destroy: () => {
      debugger$.unsubscribe()
      queriesRunnerSub.unsubscribe()
    }
  }
}
