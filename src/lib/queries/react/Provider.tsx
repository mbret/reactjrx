import {
  type ReactNode,
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo
} from "react"
import { type createClient } from "../client/createClient"

export const Context = createContext<{
  client: ReturnType<typeof createClient>
}>({
  client: null as unknown as any
})

const ClientEffect = ({
  client
}: {
  client: ReturnType<typeof createClient>
}) => {
  useEffect(() => {
    const destroy = client.start()

    return () => {
      destroy()
    }
  }, [client])

  return null
}

export const Provider = memo(
  ({
    children,
    client
  }: {
    children: ReactNode
    client: ReturnType<typeof createClient>
  }) => {
    const value = useMemo(() => ({ client }), [client])

    return (
      <Context.Provider value={value}>
        <ClientEffect client={value.client} />
        {children}
      </Context.Provider>
    )
  }
)

export const useReactJrxProvider = () => {
  const context = useContext(Context)

  if (context === null) {
    throw new Error("You forgot to register the provider")
  }

  return { ...context }
}
