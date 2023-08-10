import { type createQueryStore } from "../createQueryStore"
import { compareKeys } from "../keys/compareKeys"
import { type QueryKey } from "../keys/types"

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
    if (queryKey) {
      queryStore.updateMany({ stale: true }, (storeObject) =>
        compareKeys(queryKey, storeObject.queryKey, { exact })
      )
    } else if (predicate) {
      queryStore.updateMany({ stale: true }, predicate)
    } else {
      queryStore.updateMany({ stale: true })
    }
  }

  return {
    invalidateQueries
  }
}
