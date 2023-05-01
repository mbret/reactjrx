import { Observable } from "rxjs"
import { retryFromOptions } from "./operators"
import { QuerxOptions } from "./types"

export const querx =
  <T>(options: Pick<QuerxOptions, "retry">) =>
  (source: Observable<T>) =>
    source.pipe(retryFromOptions(options))
