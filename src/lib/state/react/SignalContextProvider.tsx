import { createContext, memo, useContext, useEffect, useMemo } from "react"
import { map } from "rxjs"
import { useObserve } from "../../binding/useObserve"
import { useConstant } from "../../utils/react/useConstant"
import type { VirtualSignal } from "../Signal"
import { SignalContext } from "../SignalContext"

export type SignalContextType = undefined | SignalContext

export const SignalReactContext = createContext<SignalContextType>(undefined)

export const SignalContextProvider = memo(
  ({ children }: { children: React.ReactNode }) => {
    const signalContext = useConstant(() => new SignalContext())

    if (signalContext.current.isDestroyed) {
      signalContext.current = new SignalContext()
    }

    const value = useMemo(() => signalContext.current, [signalContext])

    useEffect(() => {
      return () => {
        signalContext.current.destroy()
      }
    }, [signalContext])

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

  if (!signalContext) {
    if (virtualSignal) {
      throw new Error(
        "useSignalValue must be used within a SignalContextProvider",
      )
    }

    return undefined
  }

  const signals = signalContext.signals

  return useObserve(
    () =>
      signals.pipe(
        map(() =>
          virtualSignal
            ? signalContext.getOrCreateSignal(virtualSignal)
            : undefined,
        ),
      ),
    {
      defaultValue: virtualSignal
        ? signalContext.getOrCreateSignal(virtualSignal)
        : undefined,
    },
    [signals],
  )
}
