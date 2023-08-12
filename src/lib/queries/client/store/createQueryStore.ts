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

export interface StoreObject<T = unknown> {
  queryKey: QueryKey
  isStale: boolean
  lowestStaleTime?: number
  lastFetchedAt?: number
  queryCacheResult?: undefined | { result: T }
  listeners: number
}

export const createQueryStore = () => {
  const store = new Map<string, BehaviorSubject<StoreObject>>()
  const store$ = new BehaviorSubject(store)

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
    updateValue(key, (old) => ({
      ...old,
      listeners: old.listeners - 1
    }))
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

  const storeSub = store$
    .pipe(
      map((value) =>
        [...value.keys()].reduce((acc: any, key) => {
          acc[key] = getValue(key)

          return acc
        }, {})
      ),
      distinctUntilChanged(shallowEqual)
    )
    .subscribe((value) => {
      Logger.namespace("store").log("store", "update", value)
    })

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
      storeSub.unsubscribe()
      queriesRunnerSub.unsubscribe()
    }
  }
}
