import { type Observable } from "rxjs"
import { useSubscribe } from "./useSubscribe"
import { type DependencyList, useCallback } from "react"
import { useSubject } from "./useSubject"

export const useObserveCallback = <T = void, R = void>(
  callback: (source: Observable<T>) => Observable<R>,
  deps: DependencyList
) => {
  const trigger$ = useSubject<T>()

  useSubscribe(() => callback(trigger$.current), [trigger$, ...deps])

  const trigger = useCallback((arg: T) => {
    trigger$.current.next(arg)
  }, [trigger$])

  return [trigger, trigger$] as const
}
