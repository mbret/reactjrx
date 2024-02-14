import {
  type Observable,
  filter,
  first,
  merge,
  mergeMap,
} from "rxjs"
import { type FocusManager } from "../../focusManager"

export const delayWhenVisibilityChange =
  <T>(focusManager: FocusManager) =>
  (source: Observable<T>) => {
    return merge(
      focusManager.visibility$
        .pipe(
          filter((visibility) => visibility === "visible"),
          first()
        )
        .pipe(
          mergeMap(
            () => source
          )
        )
    )
  }
