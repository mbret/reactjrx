import type { NetworkMode } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  createLiveQuerySource,
  createQueryClient,
  createWrapper,
  liveQueryOptions,
} from "../../tests/liveQuery"
import { waitForTimeout } from "../../tests/utils"
import { useQuery$ } from "./useQuery$"

function setup(
  queryKey: string[],
  initialItems: string[],
  queryOptions: {
    networkMode?: NetworkMode
    gcTime?: number
    staleTime?: number
  } = liveQueryOptions,
) {
  const { liveQuery$, queryFn } = createLiveQuerySource(initialItems)
  const queryClient = createQueryClient()

  function Comp() {
    const { data } = useQuery$({
      ...queryOptions,
      queryKey,
      queryFn,
    })

    return <span data-testid="data">{JSON.stringify(data)}</span>
  }

  render(<Comp />, { wrapper: createWrapper(queryClient) })

  return { liveQuery$, queryClient }
}

const waitForData = (items: string[]) =>
  waitFor(() => {
    expect(screen.getByTestId("data").textContent).toBe(JSON.stringify(items))
  })

describe("useQuery$ live-query reactivity", () => {
  it("re-renders when a new item is added", { timeout: 3000 }, async () => {
    const { liveQuery$ } = setup(["live", "add"], ["a", "b"])

    await waitForData(["a", "b"])

    act(() => {
      liveQuery$.next(["a", "b", "c"])
    })

    await waitForData(["a", "b", "c"])
  })

  it("re-renders when an item is removed", { timeout: 3000 }, async () => {
    const { liveQuery$ } = setup(["live", "remove"], ["a", "b", "c"])

    await waitForData(["a", "b", "c"])

    act(() => {
      liveQuery$.next(["a", "c"])
    })

    await waitForData(["a", "c"])
  })

  it("re-renders with two observers on the same key", {
    timeout: 3000,
  }, async () => {
    const { liveQuery$, queryFn } = createLiveQuerySource(["a", "b"])
    const queryClient = createQueryClient()

    function useLive() {
      return useQuery$({
        ...liveQueryOptions,
        queryKey: ["live", "double"],
        queryFn,
      })
    }

    function Comp() {
      const { data } = useLive()
      useLive()

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await waitForData(["a", "b"])

    act(() => {
      liveQuery$.next(["a", "b", "c"])
    })

    await waitForData(["a", "b", "c"])
  })

  it("settles on the latest value after rapid emissions", {
    timeout: 3000,
  }, async () => {
    const { liveQuery$ } = setup(["live", "rapid"], ["a"])

    await waitForData(["a"])

    act(() => {
      liveQuery$.next(["a", "b"])
      liveQuery$.next(["a", "b", "c"])
      liveQuery$.next(["a", "b", "c", "d"])
    })

    await waitForData(["a", "b", "c", "d"])
  })

  it("survives an external refetch racing with the internal loop", {
    timeout: 3000,
  }, async () => {
    const { liveQuery$, queryClient } = setup(
      ["live", "external-refetch"],
      ["a", "b"],
      { networkMode: "always", gcTime: 0 },
    )

    await waitForData(["a", "b"])

    // Let the external call race with the internal refetch loop.
    await act(async () => {
      queryClient.refetchQueries({
        queryKey: ["live", "external-refetch"],
        exact: true,
      })
      await waitForTimeout(100)
    })

    act(() => {
      liveQuery$.next(["a", "b", "c"])
    })

    await waitForData(["a", "b", "c"])
  })

  it("survives invalidateQueries followed by a data change", {
    timeout: 3000,
  }, async () => {
    const { liveQuery$, queryClient } = setup(
      ["live", "invalidate"],
      ["a", "b"],
      { networkMode: "always", gcTime: 0 },
    )

    await waitForData(["a", "b"])

    // Let the external call race with the internal refetch loop.
    await act(async () => {
      queryClient.invalidateQueries({
        queryKey: ["live", "invalidate"],
        exact: true,
      })
      await waitForTimeout(100)
    })

    act(() => {
      liveQuery$.next(["a", "b", "c"])
    })

    await waitForData(["a", "b", "c"])
  })
})
