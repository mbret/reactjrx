/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {
  type Observable,
  catchError,
  merge,
  of,
  timer,
  mergeMap,
  throwError
} from "rxjs"
import { onlineManager } from "../../onlineManager"
import { delayWhenNetworkOnline } from "./delayWhenNetworkOnline"

export const waitForNetworkOnError = <
  T extends {
    failureCount?: number
    failureReason?: any
    isPaused?: boolean
  }
>(
  source: Observable<T>
) => {
  let attempt = 0

  return source.pipe(
    catchError((error) => {
      attempt++

      if (attempt <= 1 && !onlineManager.isOnline()) {
        return merge(
          of({
            failureCount: attempt,
            failureReason: error
          } as T),
          /**
           * @important
           * timer needed to be iso RQ, so the state returned by mutation include both previous and next one
           */
          timer(1).pipe(
            mergeMap(() =>
              throwError(() => error).pipe(delayWhenNetworkOnline<T>())
            )
          )
        )
      } else {
        return throwError(() => error)
      }
    })
  )
}
