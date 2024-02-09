import { useContext } from "react"
import { Context } from "./Provider"
import { type QueryClient } from "../client/QueryClient"

export const useQueryClient = (queryClient?: QueryClient) => {
    const context = useContext(Context)
  
    if (!queryClient && context.client === null) {
      throw new Error("You forgot to register the provider")
    }
  
    return queryClient ?? context.client
  }
  