import { act, render, screen, waitFor } from "@testing-library/react"
import { BehaviorSubject } from "rxjs"
import { describe, expect, it } from "vitest"
import {
  countSubscriptions,
  createQueryClient,
  createWrapper,
  liveQueryOptions,
} from "../../tests/liveQuery"
import { waitForTimeout } from "../../tests/utils"
import { useQueries$ } from "./useQueries$"

/**
 * Renders a component reading two live queries through one `useQueries$`.
 */
async function renderLiveQueries() {
  const first$ = new BehaviorSubject("a")
  const second$ = new BehaviorSubject("x")
  const first = countSubscriptions(first$)
  const second = countSubscriptions(second$)
  const queryClient = createQueryClient()
  const firstKey = ["live", "first"]
  const secondKey = ["live", "second"]

  function Comp() {
    "use no memo"

    const [{ data: firstData }, { data: secondData }] = useQueries$({
      queries: [
        {
          ...liveQueryOptions,
          queryKey: firstKey,
          queryFn: () => first.counted$,
        },
        {
          ...liveQueryOptions,
          queryKey: secondKey,
          queryFn: () => second.counted$,
        },
      ],
    })

    return (
      <span data-testid="data">{JSON.stringify([firstData, secondData])}</span>
    )
  }

  const { unmount } = render(<Comp />, {
    wrapper: createWrapper(queryClient),
  })

  await waitFor(() => {
    expect(screen.getByTestId("data").textContent).toBe('["a","x"]')
  })

  return {
    first$,
    second$,
    first: first.subscriptions,
    second: second.subscriptions,
    queryClient,
    firstKey,
    secondKey,
    unmount,
  }
}

describe("useQueries$ with live queries", () => {
  it("holds each query's values as soon as its stream emits them", {
    timeout: 3000,
  }, async () => {
    const live = await renderLiveQueries()

    act(() => live.first$.next("b"))

    expect(live.queryClient.getQueryData(live.firstKey)).toBe("b")

    act(() => live.second$.next("y"))

    expect(live.queryClient.getQueryData(live.secondKey)).toBe("y")
    expect(live.queryClient.getQueryData(live.firstKey)).toBe("b")
  })

  it("keeps both streams when the queries are invalidated", {
    timeout: 3000,
  }, async () => {
    const live = await renderLiveQueries()

    await act(() => live.queryClient.invalidateQueries({ queryKey: ["live"] }))

    act(() => live.first$.next("b"))

    expect(live.queryClient.getQueryData(live.firstKey)).toBe("b")
    expect(live.first).toEqual({ made: 1, open: 1 })
    expect(live.second).toEqual({ made: 1, open: 1 })
  })

  it("stops only the stream of the cancelled query", {
    timeout: 3000,
  }, async () => {
    const live = await renderLiveQueries()

    await act(() => live.queryClient.cancelQueries({ queryKey: live.firstKey }))
    await act(() => waitForTimeout(20))

    expect(live.first).toEqual({ made: 1, open: 0 })
    expect(live.second).toEqual({ made: 1, open: 1 })

    act(() => live.second$.next("y"))

    expect(live.queryClient.getQueryData(live.secondKey)).toBe("y")
  })

  it("stops both streams on unmount", {
    timeout: 3000,
  }, async () => {
    const live = await renderLiveQueries()

    live.unmount()
    await act(() => waitForTimeout(20))

    expect(live.first).toEqual({ made: 1, open: 0 })
    expect(live.second).toEqual({ made: 1, open: 0 })
  })
})
