import { type createQueryStore } from "../store/createQueryStore"
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
      queryStore.updateMany({ isStale: true }, (storeObject) =>
        compareKeys(queryKey, storeObject.queryKey, { exact })
      )
    } else if (predicate) {
      queryStore.updateMany({ isStale: true }, predicate)
    } else {
      queryStore.updateMany({ isStale: true })
    }
  }

  return {
    invalidateQueries,
    destroy: () => {}
  }
}
