import {
  type ReactNode,
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo
} from "react"
import { type QueryClient } from "../client/createClient"

export const Context = createContext<{
  client: QueryClient
}>({
  client: null as unknown as any
})

const ClientEffect = ({ client }: { client: QueryClient }) => {
  useEffect(() => {
    const stop = client.mount()

    return () => {
      stop()
    }
  }, [client])

  return null
}

export const QueryClientProvider = memo(
  ({ children, client }: { children: ReactNode; client: QueryClient }) => {
    const value = useMemo(() => ({ client }), [client])

    return (
      <Context.Provider value={value}>
        <ClientEffect client={value.client} />
        {children}
      </Context.Provider>
    )
  }
)

export const useQueryClient = ({
  unsafe = false
}: { unsafe?: boolean } = {}) => {
  const context = useContext(Context)

  if (!unsafe && context.client === null) {
    throw new Error("You forgot to register the provider")
  }

  return context.client
}
