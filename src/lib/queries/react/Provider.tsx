import {
  type ReactNode,
  createContext,
  memo,
  useContext,
  useMemo,
  useEffect
} from "react"
import { type createClient } from "../client/createClient"

export const Context = createContext<{
  client: ReturnType<typeof createClient>
}>({
  client: null as unknown as any
})

export const Provider = memo(
  ({
    children,
    client
  }: {
    children: ReactNode
    client: ReturnType<typeof createClient>
  }) => {
    const value = useMemo(() => ({ client }), [client])

    useEffect(
      () => () => {
        client.destroy()
      },
      [client]
    )

    return <Context.Provider value={value}>{children}</Context.Provider>
  }
)

export const useReactJrxProvider = () => {
  const context = useContext(Context)

  if (context === null) {
    throw new Error("You forgot to register the provider")
  }

  return { ...context }
}
