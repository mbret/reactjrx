import { type DependencyList, useEffect } from "react"
import { EMPTY, catchError } from "rxjs"
import { makeObservable } from "../utils/makeObservable"
import { useLiveRef } from "../utils/react/useLiveRef"
import type { SubscribeSource } from "./types"

export function useSubscribe<T>(
  source: SubscribeSource<T> | (() => T),
  deps: DependencyList = [],
) {
  const sourceRef = useLiveRef(source)

  useEffect(() => {
    const sub = makeObservable(sourceRef.current)()
      .pipe(
        catchError((error) => {
          console.error(error)

          return EMPTY
        }),
      )
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [...deps, sourceRef])
}
