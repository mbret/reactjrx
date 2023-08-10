import { BehaviorSubject } from "rxjs"
import { type QueryKey } from "./keys/types"

interface StoreObject {
  queryKey: QueryKey
  stale: boolean
}

export const createQueryStore = () => {
  const store = new Map<string, StoreObject>()
  const store$ = new BehaviorSubject(store)

  const setValue = (key: string, value: StoreObject) => {
    store.set(key, value)
    store$.next(store)
  }

  const updateValue = (key: string, value: Partial<StoreObject>) => {
    const existingObject = store.get(key)

    if (!existingObject) return

    store.set(key, { ...existingObject, ...value })
    store$.next(store)
  }

  const updateMany = (
    value: Partial<StoreObject>,
    predicate: (storeObject: StoreObject) => boolean = () => true
  ) => {
    store.forEach((oldValue, key) => {
      if (predicate(oldValue)) {
        store.set(key, { ...oldValue, ...value })
      }
    })

    store$.next(store)
  }

  const deleteValue = (key: string) => {
    store.delete(key)
    store$.next(store)
  }

  return {
    set: setValue,
    delete: deleteValue,
    update: updateValue,
    updateMany,
    store$
  }
}
