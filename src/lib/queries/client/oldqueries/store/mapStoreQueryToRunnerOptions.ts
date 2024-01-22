import { switchMap, type OperatorFunction, map, combineLatest } from "rxjs"
import { type StoreObject } from "./createQueryStore"
import { type DeprecatedQueryOptions } from "../../types"

export const mapStoreQueryToRunnerOptions: OperatorFunction<
  StoreObject,
  Array<DeprecatedQueryOptions<any>>
> = (stream) =>
  stream.pipe(
    switchMap((entry) => combineLatest(entry.runners)),
    map((runnerValues) => runnerValues.map(({ options }) => options))
  )
