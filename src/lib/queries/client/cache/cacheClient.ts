import { type createQueryStore } from "../store/createQueryStore"
import { type QueryKey } from "../keys/types"
import { serializeKey } from "../keys/serializeKey"
import { getInitialQueryEntity } from "../store/initializeQueryInStore"
import { logger } from "./logger"

type CallableUpdater<TQueryFnData> = (
  oldData: TQueryFnData | undefined
) => TQueryFnData | undefined

export const createCacheClient = <TQueryFnData>({
  queryStore
}: {
  queryStore: ReturnType<typeof createQueryStore>
}) => {
  const setQueryData = ({
    queryKey,
    updater
  }: {
    queryKey: QueryKey
    updater: TQueryFnData | undefined | CallableUpdater<TQueryFnData>
  }) => {
    const serializedKey = serializeKey(queryKey)

    if (queryKey.length === 0) return

    logger.log("set cache for query", serializeKey)

    if (!queryStore.get(serializedKey)) {
      queryStore.set(serializedKey, getInitialQueryEntity({ key: queryKey }))
    }

    queryStore.update(serializedKey, (entity) => {
      if (typeof updater === "function") {
        const callableUpdater = updater as CallableUpdater<TQueryFnData>

        return {
          ...entity,
          cache_fnResult: {
            result: callableUpdater(
              entity.cache_fnResult?.result as TQueryFnData | undefined
            )
          }
        }
      }

      return {
        ...entity,
        cache_fnResult: {
          result: updater
        }
      }
    })

    queryStore.dispatchQueryEvent({
      key: serializedKey,
      type: "queryDataSet"
    })
  }

  return {
    setQueryData
  }
}
