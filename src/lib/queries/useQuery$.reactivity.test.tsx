import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen } from "@testing-library/react"
import type React from "react"
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

describe("useQuery$ live-query reactivity", () => {
  it("re-renders when a new item is added", async () => {
    const liveQuery$ = new BehaviorSubject(["a", "b"])
    const db$ = new BehaviorSubject<object | undefined>({})
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey: ["live", "add"],
        queryFn: () =>
          db$.pipe(
            filter(isDefined),
            switchMap(() => liveQuery$),
            map((items) => [...items]),
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
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

  it("re-renders when an item is removed", async () => {
    const liveQuery$ = new BehaviorSubject(["a", "b", "c"])
    const db$ = new BehaviorSubject<object | undefined>({})
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey: ["live", "remove"],
        queryFn: () =>
          db$.pipe(
            filter(isDefined),
            switchMap(() => liveQuery$),
            map((items) => [...items]),
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b", "c"]),
    )

    await act(async () => {
      liveQuery$.next(["a", "c"])
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "c"]),
    )
  })

  it("re-renders with two observers on the same key", async () => {
    const liveQuery$ = new BehaviorSubject(["a", "b"])
    const db$ = new BehaviorSubject<object | undefined>({})
    const queryClient = createQueryClient()

    function useLive() {
      return useQuery$({
        ...liveQueryOptions,
        queryKey: ["live", "double"],
        queryFn: () =>
          db$.pipe(
            filter(isDefined),
            switchMap(() => liveQuery$),
            map((items) => [...items]),
          ),
      })
    }

    function Comp() {
      const { data } = useLive()
      useLive()

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
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

  it("settles on the latest value after rapid emissions", async () => {
    const liveQuery$ = new BehaviorSubject(["a"])
    const db$ = new BehaviorSubject<object | undefined>({})
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey: ["live", "rapid"],
        queryFn: () =>
          db$.pipe(
            filter(isDefined),
            switchMap(() => liveQuery$),
            map((items) => [...items]),
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(screen.getByTestId("data").textContent).toBe(JSON.stringify(["a"]))

    await act(async () => {
      liveQuery$.next(["a", "b"])
      liveQuery$.next(["a", "b", "c"])
      liveQuery$.next(["a", "b", "c", "d"])
      await new Promise((r) => setTimeout(r, 300))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b", "c", "d"]),
    )
  })

  it("survives an external refetch racing with the internal loop", async () => {
    const liveQuery$ = new BehaviorSubject(["a", "b"])
    const db$ = new BehaviorSubject<object | undefined>({})
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({
        networkMode: "always",
        gcTime: 0,
        queryKey: ["live", "external-refetch"],
        queryFn: () =>
          db$.pipe(
            filter(isDefined),
            switchMap(() => liveQuery$),
            map((items) => [...items]),
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    await act(async () => {
      queryClient.refetchQueries({
        queryKey: ["live", "external-refetch"],
        exact: true,
      })
      await new Promise((r) => setTimeout(r, 100))
    })

    await act(async () => {
      liveQuery$.next(["a", "b", "c"])
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b", "c"]),
    )
  })

  it("survives invalidateQueries followed by a data change", async () => {
    const liveQuery$ = new BehaviorSubject(["a", "b"])
    const db$ = new BehaviorSubject<object | undefined>({})
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({
        networkMode: "always",
        gcTime: 0,
        queryKey: ["live", "invalidate"],
        queryFn: () =>
          db$.pipe(
            filter(isDefined),
            switchMap(() => liveQuery$),
            map((items) => [...items]),
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    await act(async () => {
      queryClient.invalidateQueries({
        queryKey: ["live", "invalidate"],
        exact: true,
      })
      await new Promise((r) => setTimeout(r, 100))
    })

    await act(async () => {
      liveQuery$.next(["a", "b", "c"])
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(screen.getByTestId("data").textContent).toBe(
      JSON.stringify(["a", "b", "c"]),
    )
  })
})
