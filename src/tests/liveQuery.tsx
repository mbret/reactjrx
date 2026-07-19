import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { QueryClientProvider$ } from "../lib/queries/QueryClientProvider$"

export function isDefined<T>(value: T | undefined | null): value is T {
  return value != null
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
      },
    },
  })
}

export const liveQueryOptions = {
  networkMode: "always" as const,
  gcTime: 0,
  staleTime: Number.POSITIVE_INFINITY,
}

export function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <QueryClientProvider$>{children}</QueryClientProvider$>
      </QueryClientProvider>
    )
  }
}
