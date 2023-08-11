import { BehaviorSubject, distinctUntilChanged, filter, map } from "rxjs"
import { type QueryKey } from "./keys/types"
import { isDefined } from "../../utils/isDefined"
import { shallowEqual } from "../../utils/shallowEqual"
import { Logger } from "../../logger"

export interface StoreObject<T = unknown> {
  queryKey: QueryKey
  isStale: boolean
  lowestStaleTime?: number
  lastFetchedAt?: number
  queryCacheResult?: undefined | { result: T }
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

  const updateValue = (key: string, value: Partial<StoreObject>) => {
    const existingObject = store.get(key)

    if (!existingObject) return

    existingObject.next({ ...existingObject.getValue(), ...value })
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
    store$,
    destroy: () => {
      storeSub.unsubscribe()
    }
  }
}
