import { type Observable } from "rxjs"
import { retryFromOptions } from "./operators"
import { type QueryOptions } from "./types"

export const retryQueryOnFailure =
  <T>(options: Pick<QueryOptions<T>, "retry">) =>
  (source: Observable<T>) =>
    source.pipe(retryFromOptions(options))
