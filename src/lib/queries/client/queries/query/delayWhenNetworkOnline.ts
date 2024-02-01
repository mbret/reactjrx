import { type Observable, filter, first, merge, mergeMap, tap } from "rxjs"
import { onlineManager } from "../../onlineManager"

export const delayWhenNetworkOnline =
  <T>() =>
  (source: Observable<T>) => {
    return merge(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      // of({ isPaused: true } as T),
      onlineManager.backToOnline$.pipe(
        tap(() => {
          // console.log("ONLINE")
        }),
        mergeMap(
          () =>
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            // merge(of({ isPaused: false } as T), source)
            source
        )
      )
    )
  }
