import { focusManager } from "@tanstack/react-query"
import { act, render } from "@testing-library/react"
import { StrictMode, useState } from "react"
import { BehaviorSubject, of } from "rxjs"
import { describe, expect, it } from "vitest"
import {
  countSubscriptions,
  createQueryClient,
  createWrapper,
  liveQueryOptions,
} from "../../tests/liveQuery"
import { waitForTimeout } from "../../tests/utils"
import { useQuery$ } from "./useQuery$"

const settle = () => act(() => waitForTimeout(30))

/**
 * Renders a component that reads a live query. `showSecond` mounts another
 * component reading the same query, and `toggle` hides and shows the first.
 */
function setup({ readsIsFetching = false, isStrictMode = false } = {}) {
  const source$ = new BehaviorSubject(0)
  const { counted$, subscriptions } = countSubscriptions(source$)
  const queryClient = createQueryClient()
  const queryKey = ["live", "counts"]
  const stats = { renders: 0 }
  let toggle = () => {}
  let showSecond = () => {}

  const useLive = () => {
    "use no memo"

    return useQuery$({
      ...liveQueryOptions,
      queryKey,
      queryFn: () => counted$,
    })
  }

  function Live() {
    "use no memo"

    stats.renders++

    const result = useLive()

    return (
      <>
        {String(result.data)}
        {readsIsFetching ? String(result.isFetching) : null}
      </>
    )
  }

  function Second() {
    "use no memo"

    useLive()

    return null
  }

  function Host() {
    "use no memo"

    const [isVisible, setIsVisible] = useState(true)
    const [isSecondVisible, setIsSecondVisible] = useState(false)

    toggle = () => setIsVisible((value) => !value)
    showSecond = () => setIsSecondVisible(true)

    return (
      <>
        {isVisible ? <Live /> : null}
        {isSecondVisible ? <Second /> : null}
      </>
    )
  }

  const { unmount } = render(
    isStrictMode ? (
      <StrictMode>
        <Host />
      </StrictMode>
    ) : (
      <Host />
    ),
    { wrapper: createWrapper(queryClient) },
  )

  return {
    queryClient,
    queryKey,
    subscriptions,
    stats,
    unmount,
    next: (value: number) => source$.next(value),
    emit: (value: number) =>
      act(async () => {
        source$.next(value)
        await waitForTimeout(20)
      }),
    toggle: () => act(() => toggle()),
    showSecond: () => act(() => showSecond()),
  }
}

describe("live query subscriptions", () => {
  it("subscribes once to a stream that keeps emitting", {
    timeout: 3000,
  }, async () => {
    const live = setup()

    await settle()

    for (const value of [1, 2, 3, 4, 5]) await live.emit(value)

    expect(live.queryClient.getQueryData(live.queryKey)).toBe(5)
    expect(live.subscriptions).toEqual({ made: 1, open: 1 })

    live.unmount()
    await settle()

    expect(live.subscriptions).toEqual({ made: 1, open: 0 })
  })

  it("shares one subscription between components using the query", {
    timeout: 3000,
  }, async () => {
    const live = setup()

    await settle()
    await live.showSecond()
    await settle()
    await live.emit(1)

    expect(live.queryClient.getQueryData(live.queryKey)).toBe(1)
    expect(live.subscriptions).toEqual({ made: 1, open: 1 })
  })

  it("keeps the subscription on window focus", {
    timeout: 3000,
  }, async () => {
    const live = setup()

    await settle()

    try {
      await act(async () => {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
        await waitForTimeout(30)
      })
    } finally {
      focusManager.setFocused(undefined)
    }

    await live.emit(1)

    expect(live.queryClient.getQueryData(live.queryKey)).toBe(1)
    expect(live.subscriptions).toEqual({ made: 1, open: 1 })
  })

  it("keeps the subscription when the query is invalidated", {
    timeout: 3000,
  }, async () => {
    const live = setup()

    await settle()
    await act(() =>
      live.queryClient.invalidateQueries({ queryKey: live.queryKey }),
    )
    await live.emit(1)

    expect(live.queryClient.getQueryData(live.queryKey)).toBe(1)
    expect(live.subscriptions).toEqual({ made: 1, open: 1 })
  })

  it("subscribes again when the query is shown after being hidden", {
    timeout: 3000,
  }, async () => {
    const live = setup()

    await settle()
    await live.toggle()
    await settle()

    expect(live.subscriptions).toEqual({ made: 1, open: 0 })

    await live.toggle()
    await settle()
    await live.emit(1)

    expect(live.queryClient.getQueryData(live.queryKey)).toBe(1)
    expect(live.subscriptions).toEqual({ made: 2, open: 1 })
  })

  it("keeps a single subscription under StrictMode", {
    timeout: 3000,
  }, async () => {
    const live = setup({ isStrictMode: true })

    await settle()
    await live.emit(1)

    expect(live.queryClient.getQueryData(live.queryKey)).toBe(1)
    expect(live.subscriptions).toEqual({ made: 1, open: 1 })
  })

  it("subscribes once to an observable that emits once", {
    timeout: 3000,
  }, async () => {
    const { counted$, subscriptions } = countSubscriptions(of(42))
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({
        queryKey: ["one-shot"],
        queryFn: () => counted$,
      })

      return <>{String(data)}</>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await settle()

    expect(queryClient.getQueryState(["one-shot"])).toMatchObject({
      data: 42,
      fetchStatus: "idle",
    })
    expect(subscriptions).toEqual({ made: 1, open: 0 })
  })
})

describe("live query renders", () => {
  it("renders once per value when it also reads isFetching", {
    timeout: 3000,
  }, async () => {
    const live = setup({ readsIsFetching: true })

    await settle()

    // One render while pending, one for the first value.
    expect(live.stats.renders).toBe(2)

    for (const value of [1, 2, 3]) await live.emit(value)

    expect(live.stats.renders).toBe(5)
  })

  it("renders once for a burst of values", {
    timeout: 3000,
  }, async () => {
    const live = setup()

    await settle()

    const rendersBefore = live.stats.renders

    await act(async () => {
      for (const value of [1, 2, 3]) live.next(value)
      await waitForTimeout(20)
    })

    expect(live.queryClient.getQueryData(live.queryKey)).toBe(3)
    expect(live.stats.renders - rendersBefore).toBe(1)
  })

  it("renders each component render twice, and no more, under StrictMode", {
    timeout: 3000,
  }, async () => {
    const live = setup({ isStrictMode: true })

    await settle()

    // StrictMode renders twice: while pending and for the first value.
    expect(live.stats.renders).toBe(4)

    for (const value of [1, 2, 3]) await live.emit(value)

    expect(live.stats.renders).toBe(10)
  })

  it("renders twice for an observable that emits once", {
    timeout: 3000,
  }, async () => {
    const queryClient = createQueryClient()
    let renders = 0

    function Comp() {
      renders++

      const { data } = useQuery$({
        queryKey: ["one-shot"],
        queryFn: () => of(42),
      })

      return <>{String(data)}</>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await settle()

    expect(queryClient.getQueryData(["one-shot"])).toBe(42)
    // One render while pending, one for the value.
    expect(renders).toBe(2)
  })
})
