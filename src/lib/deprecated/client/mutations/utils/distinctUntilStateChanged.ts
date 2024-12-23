import { type Observable, distinctUntilChanged } from "rxjs"
import { type MutationState } from "../mutation/types"
import { shallowEqual } from "../../../../utils/shallowEqual"

export const distinctUntilStateChanged = <
  State extends MutationState<any, any, any, any>
>(
  stream: Observable<State>
) =>
  stream.pipe(
    distinctUntilChanged(
      ({ data: prevData, ...prev }, { data: currData, ...curr }) =>
        shallowEqual(prev, curr) && shallowEqual(prevData, currData)
    )
  )
