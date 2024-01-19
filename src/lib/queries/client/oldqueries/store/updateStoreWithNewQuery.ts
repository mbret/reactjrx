import {
  type OperatorFunction,
  map,
  type Observable,
  withLatestFrom
} from "rxjs"
import {
  type QueryPipelineParams,
  type QueryOptions,
  type QueryTrigger
} from "../../types"
import { getInitialQueryEntity } from "./initializeQueryInStore"

export const updateStoreWithNewQuery =
  <R>({
    queryStore,
    serializedKey,
    runner$,
    options$,
    key
  }: QueryPipelineParams<R> & {
    runner$: Observable<{
      options: QueryOptions<R>
    }>
  }): OperatorFunction<
    QueryTrigger,
    [QueryTrigger, (() => void) | undefined]
  > =>
  (stream) =>
    stream.pipe(
      withLatestFrom(options$),
      map(([trigger, options]) => {
        if (key.length === 0) return [trigger, undefined]

        if (trigger.type !== "initial") return [trigger, undefined]

        if (!queryStore.get(serializedKey)) {
          queryStore.set(serializedKey, getInitialQueryEntity({ key }))
        } else {
          queryStore.update(serializedKey, {
            queryKey: key,
            ...(options.markStale && {
              isStale: true
            })
          })
        }

        return [trigger, queryStore.addRunner(serializedKey, runner$)]
      })
    )
