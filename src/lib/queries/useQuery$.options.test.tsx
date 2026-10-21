import { act, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { BehaviorSubject } from "rxjs"
import { describe, expect, it } from "vitest"
import {
  countSubscriptions,
  createQueryClient,
  createWrapper,
  liveQueryOptions,
} from "../../tests/liveQuery"
import { waitForTimeout } from "../../tests/utils"
import { useQuery$ } from "./useQuery$"

const waitForData = (data: unknown) =>
  waitFor(() => {
    expect(screen.getByTestId("data").textContent).toBe(JSON.stringify(data))
  })

describe("live query key changes", () => {
  it("moves to the stream of the new key, and back", {
    timeout: 3000,
  }, async () => {
    const sources = {
      a: new BehaviorSubject("a1"),
      b: new BehaviorSubject("b1"),
    }
    const counted = {
      a: countSubscriptions(sources.a),
      b: countSubscriptions(sources.b),
    }
    const queryClient = createQueryClient()
    let setKey = (_key: "a" | "b") => {}

    function Comp() {
      "use no memo"

      const [key, setKeyState] = useState<"a" | "b">("a")

      setKey = setKeyState

      const { data } = useQuery$({
        ...liveQueryOptions,
        gcTime: Number.POSITIVE_INFINITY,
        queryKey: ["live", key],
        queryFn: () => counted[key].counted$,
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await waitForData("a1")

    act(() => setKey("b"))

    await waitForData("b1")
    await act(() => waitForTimeout(20))

    // The previous key's query stopped its stream and is marked stale.
    expect(counted.a.subscriptions).toEqual({ made: 1, open: 0 })
    expect(counted.b.subscriptions).toEqual({ made: 1, open: 1 })
    expect(queryClient.getQueryState(["live", "a"])?.isInvalidated).toBe(true)

    sources.a.next("a2")

    expect(queryClient.getQueryData(["live", "a"])).toBe("a1")

    act(() => setKey("a"))

    await waitForData("a2")
    await act(() => waitForTimeout(20))

    expect(counted.a.subscriptions).toEqual({ made: 2, open: 1 })
    expect(counted.b.subscriptions).toEqual({ made: 1, open: 0 })
  })
})

describe("live query enabled option", () => {
  function setup(initiallyEnabled: boolean) {
    const source$ = new BehaviorSubject("a")
    const { counted$, subscriptions } = countSubscriptions(source$)
    const queryClient = createQueryClient()
    const queryKey = ["live", "enabled"]
    let setEnabled = (_enabled: boolean) => {}

    function Comp() {
      "use no memo"

      const [enabled, setEnabledState] = useState(initiallyEnabled)

      setEnabled = setEnabledState

      const { data } = useQuery$({
        ...liveQueryOptions,
        enabled,
        queryKey,
        queryFn: () => counted$,
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    const { unmount } = render(<Comp />, {
      wrapper: createWrapper(queryClient),
    })

    return {
      source$,
      subscriptions,
      queryClient,
      queryKey,
      unmount,
      setEnabled: (enabled: boolean) => act(() => setEnabled(enabled)),
    }
  }

  it("subscribes once the query is enabled", {
    timeout: 3000,
  }, async () => {
    const live = setup(false)

    await act(() => waitForTimeout(20))

    expect(live.subscriptions).toEqual({ made: 0, open: 0 })

    await live.setEnabled(true)
    await waitForData("a")

    expect(live.subscriptions).toEqual({ made: 1, open: 1 })
  })

  it("keeps the stream running once disabled, as TanStack keeps a fetch in progress", {
    timeout: 3000,
  }, async () => {
    const live = setup(true)

    await waitForData("a")
    await live.setEnabled(false)

    act(() => live.source$.next("b"))

    expect(live.queryClient.getQueryData(live.queryKey)).toBe("b")
    expect(live.subscriptions).toEqual({ made: 1, open: 1 })

    live.unmount()
    await act(() => waitForTimeout(20))

    expect(live.subscriptions).toEqual({ made: 1, open: 0 })
  })
})

describe("live query data options", () => {
  function setup(options: {
    select?: (items: string[]) => unknown
    structuralSharing?: boolean
  }) {
    const source$ = new BehaviorSubject(["a"])
    const queryClient = createQueryClient()
    const queryKey = ["live", "data-options"]
    const stats = { renders: 0 }

    function Comp() {
      "use no memo"

      stats.renders++

      const { data } = useQuery$({
        ...liveQueryOptions,
        ...options,
        queryKey,
        queryFn: () => source$,
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    return {
      queryClient,
      queryKey,
      stats,
      emit: (items: string[]) =>
        act(async () => {
          source$.next(items)
          await waitForTimeout(20)
        }),
    }
  }

  it("re-renders only when the selected value changes", {
    timeout: 3000,
  }, async () => {
    const live = setup({ select: (items) => items.length })

    await waitForData(1)
    await act(() => waitForTimeout(20))

    const rendersBefore = live.stats.renders

    await live.emit(["a", "b"])

    expect(live.stats.renders - rendersBefore).toBe(1)

    await live.emit(["a", "c"])

    expect(live.queryClient.getQueryData(live.queryKey)).toEqual(["a", "c"])
    expect(live.stats.renders - rendersBefore).toBe(1)
  })

  it("does not re-render for a value equal to the previous one", {
    timeout: 3000,
  }, async () => {
    const live = setup({})

    await waitForData(["a"])
    await act(() => waitForTimeout(20))

    const rendersBefore = live.stats.renders
    const dataBefore = live.queryClient.getQueryData(live.queryKey)

    await live.emit(["a"])

    // Structural sharing keeps the previous value, so nothing changed.
    expect(live.queryClient.getQueryData(live.queryKey)).toBe(dataBefore)
    expect(live.stats.renders - rendersBefore).toBe(0)
  })

  it("re-renders for an equal value when structural sharing is off", {
    timeout: 3000,
  }, async () => {
    const live = setup({ structuralSharing: false })

    await waitForData(["a"])
    await act(() => waitForTimeout(20))

    const rendersBefore = live.stats.renders

    await live.emit(["a"])

    expect(live.stats.renders - rendersBefore).toBe(1)
  })
})
