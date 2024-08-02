import { type DependencyList, useEffect } from "react"
import { useLiveRef } from "../utils/useLiveRef"
import { makeObservable } from "../queries/client/utils/makeObservable"
import { type SubscribeSource } from "./types"
import { catchError, EMPTY } from "rxjs"

export function useSubscribe<T>(
  source: SubscribeSource<T>,
  deps: DependencyList = []
) {
  const sourceRef = useLiveRef(source)

  useEffect(() => {
    const sub = makeObservable(sourceRef.current)
      .pipe(
        catchError((error) => {
          console.error(error)

          return EMPTY
        })
      )
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ...deps,
    sourceRef
  ])
}
