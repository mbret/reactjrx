import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen } from "@testing-library/react"
import type React from "react"
import { useState } from "react"
import { BehaviorSubject, filter, map, switchMap } from "rxjs"
import { describe, expect, it } from "vitest"
import { QueryClientProvider$ } from "./QueryClientProvider$"
import { useQuery$ } from "./useQuery$"

function isDefined<T>(value: T | undefined | null): value is T {
  return value != null
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
      },
    },
  })
}

const liveQueryOptions = {
  networkMode: "always" as const,
  gcTime: 0,
  staleTime: Number.POSITIVE_INFINITY,
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <QueryClientProvider$>{children}</QueryClientProvider$>
      </QueryClientProvider>
    )
  }
}

describe("useQuery$ unmount / remount", () => {
  it("stays reactive after hide/show then adding an item", {
    timeout: 3000,
  }, async () => {
    const liveQuery$ = new BehaviorSubject(["a", "b"])
    const db$ = new BehaviorSubject<object | undefined>({})
    const queryClient = createQueryClient()

    function List() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey: ["unmount", "add"],
        queryFn: () =>
          db$.pipe(
            filter(isDefined),
            switchMap(() => liveQuery$),
            map((items) => [...items]),
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    let toggle: () => void

    function Host() {
      const [visible, setVisible] = useState(true)
      toggle = () => setVisible((v) => !v)

      return visible ? <List /> : <span data-testid="hidden" />
    }

    render(<Host />, { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b"]),
    )

    await act(async () => {
      toggle()
      toggle()
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b"]),
    )

    await act(async () => {
      liveQuery$.next(["a", "b", "c"])
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b", "c"]),
    )
  })

  it("stays reactive after hide/show then removing an item", {
    timeout: 3000,
  }, async () => {
    const liveQuery$ = new BehaviorSubject(["a", "b", "c"])
    const db$ = new BehaviorSubject<object | undefined>({})
    const queryClient = createQueryClient()

    function List() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey: ["unmount", "remove"],
        queryFn: () =>
          db$.pipe(
            filter(isDefined),
            switchMap(() => liveQuery$),
            map((items) => [...items]),
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    let toggle: () => void

    function Host() {
      const [visible, setVisible] = useState(true)
      toggle = () => setVisible((v) => !v)

      return visible ? <List /> : <span data-testid="hidden" />
    }

    render(<Host />, { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b", "c"]),
    )

    await act(async () => {
      toggle()
      toggle()
      await new Promise((r) => setTimeout(r, 200))
    })

    await act(async () => {
      liveQuery$.next(["a", "c"])
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "c"]),
    )
  })

  it("stays reactive after multiple hide/show cycles", {
    timeout: 5000,
  }, async () => {
    const liveQuery$ = new BehaviorSubject(["a"])
    const db$ = new BehaviorSubject<object | undefined>({})
    const queryClient = createQueryClient()

    function List() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey: ["unmount", "multi"],
        queryFn: () =>
          db$.pipe(
            filter(isDefined),
            switchMap(() => liveQuery$),
            map((items) => [...items]),
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    let toggle: () => void

    function Host() {
      const [visible, setVisible] = useState(true)
      toggle = () => setVisible((v) => !v)

      return visible ? <List /> : <span data-testid="hidden" />
    }

    render(<Host />, { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(screen.getByTestId("data").textContent).toBe(JSON.stringify(["a"]))

    for (let i = 0; i < 5; i++) {
      await act(async () => {
        toggle()
        toggle()
        await new Promise((r) => setTimeout(r, 50))
      })
    }

    expect(screen.getByTestId("data").textContent).toBe(JSON.stringify(["a"]))

    await act(async () => {
      liveQuery$.next(["a", "b"])
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b"]),
    )
  })

  /**
   * Regression: a stale refetchIfNeeded setTimeout firing after
   * deleteQuery would trigger queryFnAsync on a defunct cache entry,
   * creating an orphaned take(1) subscriber that accumulates emissions
   * and resolves with stale data in bulk.
   *
   * The guard `if (queryCacheEntry?.isCompleted) return` inside the
   * setTimeout callback prevents this.
   */
  it("does not create orphaned subscriptions when refetch races with hide/show", {
    timeout: 3000,
  }, async () => {
    const liveQuery$ = new BehaviorSubject(["a"])
    const db$ = new BehaviorSubject<object | undefined>({})
    const queryClient = createQueryClient()

    function List() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey: ["unmount", "stale-guard"],
        queryFn: () =>
          db$.pipe(
            filter(isDefined),
            switchMap(() => liveQuery$),
            map((items) => [...items]),
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    let toggle: () => void

    function Host() {
      const [visible, setVisible] = useState(true)
      toggle = () => setVisible((v) => !v)

      return visible ? <List /> : <span data-testid="hidden" />
    }

    render(<Host />, { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(screen.getByTestId("data").textContent).toBe(JSON.stringify(["a"]))

    await act(async () => {
      liveQuery$.next(["a", "b"])
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b"]),
    )

    liveQuery$.next(["a", "b", "c"])

    await act(async () => {
      toggle()
      toggle()
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b", "c"]),
    )

    await act(async () => {
      liveQuery$.next(["a", "b", "c", "d"])
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b", "c", "d"]),
    )
  })
})
