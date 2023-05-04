import { useLiveRef } from "../utils/useLiveRef"
import { useEffect } from "react"
import { type Signal } from "./signal"
import { SIGNAL_RESET } from "./constants"

/**
 * Will reset signals when the scope is unmounted
 */
export const useScopeSignals = (signals: Array<Signal<any, any>>) => {
  const signalsRef = useLiveRef(signals)

  useEffect(
    () => () => {
      signalsRef.current.forEach(({ setState }) => {
        setState(SIGNAL_RESET)
      })
    },
    []
  )
}
