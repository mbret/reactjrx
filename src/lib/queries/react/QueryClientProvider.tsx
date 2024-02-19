import {
  type ReactNode,
  createContext,
  memo,
  useEffect,
  useMemo
} from "react"
import { type QueryClient } from "../client/QueryClient"

export const Context = createContext<{
  client: QueryClient
}>({
  client: null as unknown as any
})

const ClientEffect = ({ client }: { client: QueryClient }) => {
  useEffect(() => {
    client.mount()

    return () => {
      client.unmount()
    }
  }, [client])

  return null
}

export const QueryClientProvider = memo(
  ({ children, client }: { children: ReactNode; client: QueryClient }) => {
    const value = useMemo(() => ({ client }), [client])

    return (
      <Context.Provider value={value}>
        <ClientEffect client={client} />
        {children}
      </Context.Provider>
    )
  }
)
