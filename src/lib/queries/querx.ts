import { Observable } from "rxjs"
import { retryFromOptions } from "./operators"
import { QuerxOptions } from "./types"

export const querx =
  <T>(options: QuerxOptions) =>
  (source: Observable<T>) =>
    source.pipe(retryFromOptions(options))
