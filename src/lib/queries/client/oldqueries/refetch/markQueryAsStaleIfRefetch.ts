import { type MonoTypeOperatorFunction, tap } from "rxjs"
import { type QueryPipelineParams, type QueryTrigger } from "../../types"
import { logger } from "./logger"

export const markQueryAsStaleIfRefetch =
  <T>({
    key,
    serializedKey,
    queryStore
  }: QueryPipelineParams<T>): MonoTypeOperatorFunction<QueryTrigger> =>
  (stream) => {
    return stream.pipe(
      tap((trigger) => {
        if (trigger.type !== "refetch") return

        const query = queryStore.get(serializedKey)

        if (query && trigger.ignoreStale && !query.isStale) {
          logger.log(key, "marked stale by trigger!")

          queryStore.update(serializedKey, {
            isStale: true
          })
        }
      })
    )
  }
