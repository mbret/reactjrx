"use client"

import {
  type ReactNode,
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo
} from "react"
import { type QueryClient } from "../client/QueryClient"

export const Context = createContext<{
  client: QueryClient
}>({
  client: null as unknown as any
})

export const QueryClientProvider = memo(
  ({ children, client }: { children: ReactNode; client: QueryClient }) => {
    const value = useMemo(() => ({ client }), [client])

    useEffect(() => {
      client.mount()

      return () => {
        client.unmount()
      }
    }, [client])

    return <Context.Provider value={value}>{children}</Context.Provider>
  }
)

export const useQueryClient = (queryClient?: QueryClient) => {
  const context = useContext(Context)

  if (!queryClient && context.client === null) {
    throw new Error("You forgot to register the provider")
  }

  return queryClient ?? context.client
}
