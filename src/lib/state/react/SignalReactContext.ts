import { createContext } from "react"
import type { SignalContext } from "../SignalContext.ts"

export const SignalReactContext = createContext<SignalContext | undefined>(
  undefined,
)
