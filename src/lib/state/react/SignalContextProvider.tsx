import { memo, useState } from "react"
import { SignalContext } from "../SignalContext"
import { SignalReactContext } from "./SignalReactContext"

/**
 * Holds the signals of the virtual signals used under it, for as long as it
 * is mounted. They never complete.
 */
export const SignalContextProvider = memo(function SignalContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [signalContext] = useState(() => new SignalContext())

  return (
    <SignalReactContext.Provider value={signalContext}>
      {children}
    </SignalReactContext.Provider>
  )
})
