import { useContext } from "react"
import { Context } from "./QueryClientProvider"
import { type QueryClient } from "../client/QueryClient"

export const useQueryClient = (queryClient?: QueryClient) => {
  const client = useContext(Context)

  if (queryClient) {
    return queryClient
  }

  if (!client) {
    throw new Error("No QueryClient set, use QueryClientProvider to set one")
  }

  return client
}
