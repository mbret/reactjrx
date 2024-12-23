import { type Observable, takeWhile } from "rxjs"
import { type MutationState } from "./types"

export const observeUntilFinished = <
  T extends MutationState<any, any, any, any>
>(
  source: Observable<T>
) =>
  source.pipe(
    takeWhile(
      (result) => result.status !== "error" && result.status !== "success",
      true
    )
  )
