import {
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { map } from "rxjs"
import { useObserve } from "../../binding/useObserve"
import type { VirtualSignal } from "../Signal"
import { SignalContext } from "../SignalContext"

export type SignalContextType = undefined | SignalContext

export const SignalReactContext = createContext<SignalContextType>(undefined)

export const SignalContextProvider = memo(
  ({ children }: { children: React.ReactNode }) => {
    const [signalContext, setSignalContext] = useState<SignalContextType>(
      () => new SignalContext(),
    )

    if (signalContext?.isDestroyed) {
      setSignalContext(new SignalContext())
    }

    const value = useMemo(() => signalContext, [signalContext])

    useEffect(() => {
      return () => {
        signalContext?.destroy()
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
