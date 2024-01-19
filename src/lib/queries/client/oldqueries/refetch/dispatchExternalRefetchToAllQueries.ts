import { type MonoTypeOperatorFunction, tap, filter } from "rxjs"
import { type QueryPipelineParams, type QueryTrigger } from "../../types"

export const dispatchExternalRefetchToAllQueries =
  <R>({
    queryStore,
    serializedKey
  }: Pick<
    QueryPipelineParams<R>,
    "queryStore" | "serializedKey"
  >): MonoTypeOperatorFunction<QueryTrigger> =>
  (stream) =>
    stream.pipe(
      tap((trigger) => {
        if (trigger.type === "refetch") {
          /**
           * @important
           * to avoid a case where we start a refetch right after one query is successful
           * and the other one are still not complete (due to two step observable). we have
           * to manually remove the deduplication otherwise we end up in queries re-subscribing
           * to the previous "was gonna complete" function.
           */
          queryStore.update(serializedKey, {
            deduplication_fn: undefined
          })

          queryStore.dispatchQueryTrigger({
            key: serializedKey,
            trigger
          })
        }
      }),
      filter((trigger) => trigger.type !== "refetch")
    )
