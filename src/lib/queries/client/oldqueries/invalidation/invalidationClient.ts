import { type createQueryStore } from "../store/createQueryStore"
import { compareKeys } from "../../keys/compareKeys"
import { type QueryKey } from "../../keys/types"
import { serializeKey } from "../../keys/serializeKey"
import { logger } from "./logger"

export const createInvalidationClient = ({
  queryStore
}: {
  queryStore: ReturnType<typeof createQueryStore>
}) => {
  const invalidateQueries = ({
    queryKey,
    exact = false,
    predicate
  }: {
    queryKey?: QueryKey
    exact?: boolean
    predicate?: Parameters<typeof queryStore.updateMany>[1]
  } = {}) => {
    let keysToRefetch: string[] = []

    if (queryKey) {
      logger.log(`invalidation requested for`, queryKey)

      queryStore.updateMany({ isStale: true }, (entry) => {
        const isValid = compareKeys(queryKey, entry.queryKey, { exact })

        if (isValid) {
          keysToRefetch.push(serializeKey(entry.queryKey))
        }

        return isValid
      })
    } else if (predicate) {
      queryStore.updateMany({ isStale: true }, (entry) => {
        const isValid = predicate(entry)

        if (isValid) {
          keysToRefetch.push(serializeKey(entry.queryKey))
        }

        return isValid
      })
    } else {
      logger.log(`Invalidation requested for all queries`)
      queryStore.updateMany({ isStale: true })
      keysToRefetch = Array.from(queryStore.keys())
    }

    keysToRefetch.forEach((key) => {
      /**
       * @important
       * to avoid a case where we start a refetch right after one query is successful
       * and the other one are still not complete (due to two step observable). we have
       * to manually remove the deduplication otherwise we end up in queries re-subscribing
       * to the previous "was gonna complete" function.
       */
      queryStore.update(key, {
        deduplication_fn: undefined
      })

      queryStore.dispatchQueryTrigger({
        key,
        trigger: { ignoreStale: true, type: "refetch" }
      })
    })
  }

  return {
    invalidateQueries
  }
}