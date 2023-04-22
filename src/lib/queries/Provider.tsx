import { ReactNode, createContext } from "react"

export const Context = createContext<undefined>(undefined)

export const Provider = ({ children }: { children: ReactNode }) => {
  return <Context.Provider value={undefined}>{children}</Context.Provider>
}
