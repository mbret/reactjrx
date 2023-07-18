import { filter, map, pairwise, startWith } from "rxjs"
import type { Observable } from "rxjs"
import { serializeKey } from "./serializeKey"
import { isDefined } from "../../utils/isDefined"

export const withKeyComparison = <T extends { key: any[] }>(
  stream: Observable<T>
) =>
  stream.pipe(
    startWith(undefined),
    pairwise(),
    map(([previous, current]) => {
      if (current) {
        if (!previous) {
          return {
            ...current,
            previousKey: undefined,
            isUsingDifferentKey: true
          }
        }

        const serializedKey = serializeKey(current.key)
        const serializedPreviousKey = serializeKey(previous.key)

        return {
          ...current,
          previousKey: previous?.key ?? current.key,
          isUsingDifferentKey: serializedPreviousKey !== serializedKey
        }
      }

      return undefined
    }),
    filter(isDefined)
  )
