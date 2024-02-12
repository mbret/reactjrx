import {
  type Observable,
  merge,
  mergeMap,
  defer,
  of,
  type MonoTypeOperatorFunction
} from "rxjs"
import { onlineManager } from "../../onlineManager"
import { type QueryOptions } from "../types"
import { type QueryState } from "./types"

type Result<TData, TError> = Partial<QueryState<TData, TError>>

export const delayOnNetworkMode = <TData, TError>(
  options: Pick<QueryOptions, "networkMode"> & {
    onNetworkRestored: MonoTypeOperatorFunction<Result<TData, TError>>
  }
) => {
  let attempts = 0

  return (source: Observable<Result<TData, TError>>): Observable<Result<TData, TError>> => {
    const runWhenOnline$ = onlineManager.backToOnline$.pipe(
      mergeMap(() =>
        merge(
          of({ fetchStatus: "fetching" } satisfies Partial<QueryState>),
          source
        ).pipe(options.onNetworkRestored)
      )
    )

    return defer(() => {
      attempts++

      if (
        !onlineManager.isOnline() &&
        options.networkMode === "offlineFirst" &&
        attempts > 1
      ) {
        return merge(
          of({ fetchStatus: "paused" } satisfies Result<TData, TError>),
          runWhenOnline$
        )
      }

      if (
        !onlineManager.isOnline() &&
        options.networkMode !== "always" &&
        options.networkMode !== "offlineFirst"
      ) {
        return merge(
          of({ fetchStatus: "paused" } satisfies Result<TData, TError>),
          runWhenOnline$
        )
      }

      return source
    })
  }
}
