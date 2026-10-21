import { onlineManager } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import { Subject } from "rxjs"
import { afterEach, describe, expect, it } from "vitest"
import {
  countSubscriptions,
  createQueryClient,
  createWrapper,
  liveQueryOptions,
} from "../../tests/liveQuery"
import { waitForTimeout } from "../../tests/utils"
import { useQuery$ } from "./useQuery$"

afterEach(() => {
  onlineManager.setOnline(true)
})

/**
 * Renders a live query that only fetches online, and goes offline before its
 * first value: the fetch that follows the stream then waits for the network.
 */
async function renderPausedLiveQuery() {
  const source$ = new Subject<string>()
  const { counted$, subscriptions } = countSubscriptions(source$)
  const queryClient = createQueryClient()
  const queryKey = ["live", "offline"]

  function Comp() {
    "use no memo"

    const { data } = useQuery$({
      ...liveQueryOptions,
      gcTime: Number.POSITIVE_INFINITY,
      networkMode: "online",
      queryKey,
      queryFn: () => counted$,
    })

    return <span data-testid="data">{JSON.stringify(data)}</span>
  }

  const { unmount } = render(<Comp />, {
    wrapper: createWrapper(queryClient),
  })

  await act(() => waitForTimeout(20))

  act(() => onlineManager.setOnline(false))
  act(() => source$.next("a"))

  await waitFor(() => {
    expect(screen.getByTestId("data").textContent).toBe('"a"')
  })

  return { source$, subscriptions, queryClient, queryKey, unmount }
}

describe("live query while offline", () => {
  it("keeps writing values while the fetch that follows the stream waits for the network", {
    timeout: 3000,
  }, async () => {
    const { source$, subscriptions, queryClient, queryKey } =
      await renderPausedLiveQuery()

    expect(queryClient.getQueryState(queryKey)?.fetchStatus).toBe("paused")

    act(() => source$.next("b"))

    expect(queryClient.getQueryData(queryKey)).toBe("b")

    act(() => onlineManager.setOnline(true))

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKey)?.fetchStatus).toBe("fetching")
    })

    act(() => source$.next("c"))

    expect(queryClient.getQueryData(queryKey)).toBe("c")
    expect(subscriptions).toEqual({ made: 1, open: 1 })
  })

  it("restarts the stream on a refetch while the fetch that follows it waits for the network", {
    timeout: 3000,
  }, async () => {
    const { source$, subscriptions, queryClient, queryKey } =
      await renderPausedLiveQuery()

    await act(() => queryClient.refetchQueries({ queryKey }))

    // As for any query, the refetch waits for the network to run.
    expect(subscriptions).toEqual({ made: 1, open: 0 })

    act(() => onlineManager.setOnline(true))
    await act(() => waitForTimeout(20))

    expect(subscriptions).toEqual({ made: 2, open: 1 })

    act(() => source$.next("b"))

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKey)).toMatchObject({
        data: "b",
        fetchStatus: "fetching",
      })
    })
  })

  it("stops the stream on cancelQueries while the fetch that follows it waits for the network", {
    timeout: 3000,
  }, async () => {
    const { source$, subscriptions, queryClient, queryKey } =
      await renderPausedLiveQuery()

    await act(() => queryClient.cancelQueries({ queryKey }))

    expect(subscriptions).toEqual({ made: 1, open: 0 })
    expect(queryClient.getQueryState(queryKey)).toMatchObject({
      data: "a",
      fetchStatus: "idle",
    })

    act(() => source$.next("b"))

    expect(queryClient.getQueryData(queryKey)).toBe("a")
  })

  it("stops the stream when its last observer unmounts while offline", {
    timeout: 3000,
  }, async () => {
    const { subscriptions, unmount } = await renderPausedLiveQuery()

    unmount()
    await act(() => waitForTimeout(20))

    expect(subscriptions).toEqual({ made: 1, open: 0 })
  })
})
