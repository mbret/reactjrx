import { type Observable, merge, mergeMap, of } from "rxjs"
import { onlineManager } from "../../onlineManager"

export const delayWhenNetworkOnline =
  <T extends { isPaused?: boolean }>() =>
  (source: Observable<T>) => {
    return merge(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      of({ isPaused: true } as T),
      onlineManager.backToOnline$.pipe(
        mergeMap(() =>
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          merge(of({ isPaused: false } as T), source)
        )
      )
    )
  }
