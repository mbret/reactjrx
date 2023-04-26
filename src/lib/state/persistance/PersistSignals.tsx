import { ReactNode } from "react"
import { withPersistance } from "./withPersistance"
import { useLiveRef } from "../../utils/useLiveRef"
import { useObserve } from "../../binding/useObserve"
import {
  EMPTY,
  catchError,
  from,
  map,
  merge,
  of,
  switchMap,
  tap,
  throttleTime,
  zip
} from "rxjs"
import { useSubscribe } from "../../binding/useSubscribe"
import { Adapter } from "./types"
import { createLocalStorageAdapter } from "./createLocalstorageAdapter"

export const PersistSignals = ({
  children,
  signals = [],
  onReady,
  adapter = createLocalStorageAdapter(localStorage)
}: {
  children: ReactNode
  signals?: ReturnType<typeof withPersistance>[0][]
  onReady?: () => void
  adapter?: Adapter
}) => {
  const persistanceRef = useLiveRef(signals)
  const onReadyRef = useLiveRef(onReady)
  const adapterRef = useLiveRef(adapter)

  const isHydrated =
    useObserve(() => {
      const items = persistanceRef.current

      const stream =
        items.length === 0
          ? of(true)
          : zip(
              ...items.map(([hydrate]) =>
                from(hydrate({ adapter: adapterRef.current }))
              )
            ).pipe(map(() => true))

      return stream.pipe(
        tap(() => {
          console.log("hydration complete")

          onReadyRef.current && onReadyRef.current()
        }),
        catchError((error) => {
          console.error("Unable to hydrate", error)

          return EMPTY
        })
      )
    }, []) ?? false

  useSubscribe(
    () =>
      !isHydrated
        ? EMPTY
        : merge(
            ...persistanceRef.current.map(([, persist, state$]) =>
              state$.pipe(
                throttleTime(500, undefined, {
                  trailing: true
                }),
                switchMap(() => from(persist({ adapter })))
              )
            )
          ),
    [isHydrated, adapter]
  )

  return isHydrated ? <>{children}</> : null
}
