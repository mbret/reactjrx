import { type Observable, merge, mergeMap, defer, of } from "rxjs"
import { onlineManager } from "../../onlineManager"
import { type QueryOptions } from "../types"
import { type QueryState } from "./types"

export const delayOnNetworkMode = <T>(
  options: Pick<QueryOptions, "networkMode">
) => {
  type Result = Partial<QueryState>
  let attempts = 0

  return (source: Observable<T>) => {
    const runWhenOnline$ = onlineManager.backToOnline$.pipe(
      mergeMap(() => source)
    )

    return defer(() => {
      attempts++

      if (
        !onlineManager.isOnline() &&
        options.networkMode === "offlineFirst" &&
        attempts > 1
      ) {
        return merge(
          of({ fetchStatus: "paused" } satisfies Result),
          runWhenOnline$
        )
      }

      if (
        !onlineManager.isOnline() &&
        options.networkMode !== "always" &&
        options.networkMode !== "offlineFirst"
      ) {
        return merge(
          of({ fetchStatus: "paused" } satisfies Result),
          runWhenOnline$
        )
      }

      return source
    })
  }
}
