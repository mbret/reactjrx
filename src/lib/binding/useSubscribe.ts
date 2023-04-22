import { DependencyList, useEffect } from "react"
import { Observable, catchError, EMPTY } from "rxjs"
import { useLiveRef } from "./utils/useLiveRef"

export function useSubscribe<T>(source: Observable<T>): void

export function useSubscribe<T>(
  source$: () => Observable<T>,
  deps: DependencyList
): void

export function useSubscribe<T>(
  source: Observable<T> | (() => Observable<T>),
  deps: DependencyList = []
) {
  const sourceRef = useLiveRef(source)
  const sourceAsObservable = typeof source === "function" ? undefined : source

  useEffect(() => {
    const source = sourceRef.current
    const makeObservable = typeof source === "function" ? source : () => source

    const sub = makeObservable()
      .pipe(
        catchError((error) => {
          console.error(
            "Uncaught error at useSubscribe. Please consider adding a catchError or other handling."
          )
          console.error(error)

          return EMPTY
        })
      )
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [...deps, sourceAsObservable])
}
