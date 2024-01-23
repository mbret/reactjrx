import {
  type Observable,
  filter,
  first,
  merge,
  mergeMap,
  of,
  from,
  fromEvent,
  startWith,
  tap
} from "rxjs"
import { onlineManager } from "../../onlineManager"
import { type FocusManager, focusManager } from "../../focusManager"

export const delayWhenVisibilityChange =
  <T>(focusManager: FocusManager) =>
  (source: Observable<T>) => {
    return merge(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      // of({ isPaused: true } as T),
      focusManager.visibility$
        .pipe(
          filter((visibility) => visibility === "visible"),
          first()
        )
        .pipe(
          mergeMap(
            () => source
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            // merge(of({ isPaused: false } as T), source)
          )
        )
    )
  }
