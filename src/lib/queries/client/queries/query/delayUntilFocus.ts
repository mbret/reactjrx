import {
  type Observable,
  mergeMap,
  defer
} from "rxjs"
import { focusManager } from "../../focusManager"

export const delayUntilFocus = <T>(source: Observable<T>): Observable<T> => {
  return defer(() => {
    if (!focusManager.isFocused()) {
      return focusManager.focusRegained$.pipe(mergeMap(() => source))
    }

    return source
  })
}
