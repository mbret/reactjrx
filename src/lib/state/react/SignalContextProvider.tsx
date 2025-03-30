import { createContext, memo, useContext, useEffect, useState } from "react"
import { useRefOnce } from "../../utils/react/useRefOnce"
import type { VirtualSignal } from "../Signal"
import { SignalContext } from "../SignalContext"

export type SignalContextType = SignalContext

export const SignalReactContext = createContext<SignalContextType>(
  new SignalContext(),
)

export const SignalContextProvider = memo(
  ({ children }: { children: React.ReactNode }) => {
    const signalContextRef = useRefOnce<SignalContextType>(
      () => new SignalContext(),
    )
    const signalContext = signalContextRef.current
    const [isDestroyed, setIsDestroyed] = useState(false)

    if (isDestroyed) {
      signalContextRef.current = new SignalContext()
      setIsDestroyed(false)
    }

    const value = signalContext

    useEffect(() => {
      return () => {
        signalContextRef.current?.destroy()
        // force re-render
        setIsDestroyed(true)
      }
    }, [signalContextRef])

    return (
      <SignalReactContext.Provider value={value}>
        {children}
      </SignalReactContext.Provider>
    )
  },
)

export const useSignalContext = () => {
  const value = useContext(SignalReactContext)

  return value
}

export const useMakeOrRetrieveSignal = (
  virtualSignal?: VirtualSignal<unknown>,
) => {
  const signalContext = useSignalContext()

  const signal = virtualSignal
    ? signalContext.getOrCreateSignal(virtualSignal)
    : undefined

  return signal
}
