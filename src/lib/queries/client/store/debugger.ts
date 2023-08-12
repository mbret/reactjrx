import {
  type BehaviorSubject,
  type Observable,
  distinctUntilChanged,
  map
} from "rxjs"
import { type StoreObject } from "./createQueryStore"
import { shallowEqual } from "../../../utils/shallowEqual"
import { Logger } from "../../../logger"

const logger = Logger.namespace("store")

export const createDebugger = (
  store$: Observable<Map<string, BehaviorSubject<StoreObject>>>
) => {
  return store$
    .pipe(
      map((value) =>
        [...value.keys()].reduce((acc: any, key) => {
          acc[key] = value.get(key)

          return acc
        }, {})
      ),
      distinctUntilChanged(shallowEqual)
    )
    .subscribe((value) => {
      logger.log("store", "update", value)
    })
}
