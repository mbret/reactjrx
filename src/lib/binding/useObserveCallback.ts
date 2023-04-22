import { Observable } from "rxjs"
import { useSubscribe } from "./useSubscribe"
import { useTrigger } from "./useTrigger"
import { DependencyList } from "react"

export const useObserveCallback = <T = void, R>(
  callback: (source: Observable<T>) => Observable<R>,
  deps: DependencyList
) => {
  const [trigger$, trigger] = useTrigger<T>()

  useSubscribe(() => callback(trigger$), [trigger$, ...deps])

  return [trigger, trigger$] as const
}
