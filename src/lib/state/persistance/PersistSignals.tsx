import {
  type ReactNode,
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo
} from "react"
import { type withPersistance } from "./withPersistance"
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
import { type Adapter } from "./types"
import { createLocalStorageAdapter } from "./createLocalStorageAdapter"
import { SIGNAL_RESET } from "../constants"
import { useSubject } from "../../binding/useSubject"

const PersistSignalsContext = createContext({
  resetSignals: () => {}
})

export const usePersistSignalsContext = () => useContext(PersistSignalsContext)

export const PersistSignals = memo(
  ({
    children,
    signals = [],
    onReady,
    adapter = createLocalStorageAdapter(localStorage)
  }: {
    children: ReactNode
    signals?: Array<ReturnType<typeof withPersistance<any>>[0]>
    onReady?: () => void
    adapter?: Adapter
  }) => {
    const persistanceRef = useLiveRef(signals)
    const onReadyRef = useLiveRef(onReady)
    const adapterRef = useLiveRef(adapter)
    const resetSignalSubject = useSubject<void>()

    const resetSignals = useCallback(() => {
      persistanceRef.current.forEach(({ setValue }) => {
        setValue(SIGNAL_RESET)
      })
      resetSignalSubject.current.next()
    }, [])

    const value = useMemo(() => ({ resetSignals }), [resetSignals])

    const isHydrated =
      useObserve(() => {
        const items = persistanceRef.current

        const stream =
          items.length === 0
            ? of(true)
            : zip(
                ...items.map(({ hydrateValue }) =>
                  from(hydrateValue({ adapter: adapterRef.current }))
                )
              ).pipe(map(() => true))

        return stream.pipe(
          tap(() => {
            console.log("hydration complete")
            if (onReadyRef.current != null) onReadyRef.current()
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
              ...persistanceRef.current.map(({ persistValue, $ }) =>
                // @todo test the reset
                merge(
                  resetSignalSubject.current,
                  $.pipe(
                    throttleTime(500, undefined, {
                      trailing: true,
                      leading: false
                    })
                  )
                ).pipe(switchMap(() => from(persistValue({ adapter }))))
              )
            ),
      [isHydrated, adapter]
    )

    return isHydrated ? (
      <PersistSignalsContext.Provider value={value}>
        {children}
      </PersistSignalsContext.Provider>
    ) : null
  }
)
