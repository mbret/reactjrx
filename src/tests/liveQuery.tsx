import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { BehaviorSubject, filter, map, switchMap } from "rxjs"
import { QueryClientProvider$ } from "../lib/queries/QueryClientProvider$"
import { isDefined } from "../lib/utils/isDefined"

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
 * Emulates a live query backed by a database: `queryFn` waits for the db to
 * be ready then emits a fresh copy of the current items whenever `liveQuery$`
 * pushes a new list.
 */
export function createLiveQuerySource(initialItems: string[]) {
  const liveQuery$ = new BehaviorSubject(initialItems)
  const db$ = new BehaviorSubject<object | undefined>({})

  const queryFn = () =>
    db$.pipe(
      filter(isDefined),
      switchMap(() => liveQuery$),
      map((items) => [...items]),
    )

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
