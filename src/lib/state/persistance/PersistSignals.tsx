import { ReactNode } from "react"
import { withPersistance } from "./withPersistance"
import { useLiveRef } from "../../utils/useLiveRef"
import { useObserve } from "../../binding/useObserve"
import {
  EMPTY,
  from,
  map,
  merge,
  skip,
  switchMap,
  throttleTime,
  zip
} from "rxjs"
import { useSubscribe } from "../../binding/useSubscribe"

export const PersistSignals = ({
  children,
  signals
}: {
  children: ReactNode
  signals: ReturnType<typeof withPersistance>[0][]
}) => {
  const persistanceRef = useLiveRef(signals)

  const isHydrated =
    useObserve(
      () =>
        zip(...persistanceRef.current.map(([hydrate]) => from(hydrate()))).pipe(
          map(() => {
            console.log("hydration complete")

            return true
          })
        ),
      []
    ) ?? false

  useSubscribe(
    () =>
      !isHydrated
        ? EMPTY
        : merge(
            ...persistanceRef.current.map(([, persist, state$]) =>
              state$.pipe(
                skip(1),
                throttleTime(500, undefined, {
                  trailing: true
                }),
                switchMap(() => from(persist()))
              )
            )
          ),
    [isHydrated]
  )

  return isHydrated ? <>{children}</> : null
}
