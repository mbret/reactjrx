import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { BehaviorSubject, map, Observable } from "rxjs"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
      },
    },
  })
}

/**
 * Options for a live query. It keeps the default `staleTime`: automatic
 * refetches join a running stream anyway, and a longer one would keep a
 * stopped or restored query from reopening its stream.
 */
export const liveQueryOptions = {
  networkMode: "always" as const,
  gcTime: 0,
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

/**
 * Wraps `source` to count its subscriptions: how many were made, and how
 * many are still open.
 */
export function countSubscriptions<T>(source: Observable<T>) {
  const subscriptions = { made: 0, open: 0 }

  const counted$ = new Observable<T>((subscriber) => {
    subscriptions.made++
    subscriptions.open++

    const subscription = source.subscribe(subscriber)

    return () => {
      subscriptions.open--
      subscription.unsubscribe()
    }
  })

  return { counted$, subscriptions }
}

export function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}
