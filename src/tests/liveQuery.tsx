import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { BehaviorSubject, map } from "rxjs"
import { QueryClientProvider$ } from "../lib/queries/QueryClientProvider$"

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

/**
 * Emulates a live database query: `queryFn` emits a fresh copy of the current
 * items whenever `liveQuery$` pushes a new list.
 */
export function createLiveQuerySource(initialItems: string[]) {
  const liveQuery$ = new BehaviorSubject(initialItems)

  const queryFn = () => liveQuery$.pipe(map((items) => [...items]))

  return { liveQuery$, queryFn }
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
