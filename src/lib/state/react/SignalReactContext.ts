import { createContext } from "react"
import type { SignalContext } from "../SignalContext"

export const SignalReactContext = createContext<SignalContext | undefined>(
  undefined,
)
