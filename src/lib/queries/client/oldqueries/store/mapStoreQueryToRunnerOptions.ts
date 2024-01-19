import { switchMap, type OperatorFunction, map, combineLatest } from "rxjs"
import { type StoreObject } from "./createQueryStore"
import { type QueryOptions } from "../../types"

export const mapStoreQueryToRunnerOptions: OperatorFunction<
  StoreObject,
  Array<QueryOptions<any>>
> = (stream) =>
  stream.pipe(
    switchMap((entry) => combineLatest(entry.runners)),
    map((runnerValues) => runnerValues.map(({ options }) => options))
  )
