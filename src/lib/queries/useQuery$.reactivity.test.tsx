import type { NetworkMode } from "@tanstack/react-query"
import { act, render, screen } from "@testing-library/react"
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

const expectData = (items: string[]) =>
  expect(screen.getByTestId("data").textContent).toBe(JSON.stringify(items))

describe("useQuery$ live-query reactivity", () => {
  it("re-renders when a new item is added", async () => {
    const { liveQuery$ } = setup(["live", "add"], ["a", "b"])

    await act(async () => {
      await waitForTimeout(100)
    })

    expectData(["a", "b"])

    await act(async () => {
      liveQuery$.next(["a", "b", "c"])
      await waitForTimeout(200)
    })

    expectData(["a", "b", "c"])
  })

  it("re-renders when an item is removed", async () => {
    const { liveQuery$ } = setup(["live", "remove"], ["a", "b", "c"])

    await act(async () => {
      await waitForTimeout(100)
    })

    expectData(["a", "b", "c"])

    await act(async () => {
      liveQuery$.next(["a", "c"])
      await waitForTimeout(200)
    })

    expectData(["a", "c"])
  })

  it("re-renders with two observers on the same key", async () => {
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

    await act(async () => {
      await waitForTimeout(100)
    })

    expectData(["a", "b"])

    await act(async () => {
      liveQuery$.next(["a", "b", "c"])
      await waitForTimeout(200)
    })

    expectData(["a", "b", "c"])
  })

  it("settles on the latest value after rapid emissions", async () => {
    const { liveQuery$ } = setup(["live", "rapid"], ["a"])

    await act(async () => {
      await waitForTimeout(100)
    })

    expectData(["a"])

    await act(async () => {
      liveQuery$.next(["a", "b"])
      liveQuery$.next(["a", "b", "c"])
      liveQuery$.next(["a", "b", "c", "d"])
      await waitForTimeout(300)
    })

    expectData(["a", "b", "c", "d"])
  })

  it("survives an external refetch racing with the internal loop", async () => {
    const { liveQuery$, queryClient } = setup(
      ["live", "external-refetch"],
      ["a", "b"],
      { networkMode: "always", gcTime: 0 },
    )

    await act(async () => {
      await waitForTimeout(100)
    })

    await act(async () => {
      queryClient.refetchQueries({
        queryKey: ["live", "external-refetch"],
        exact: true,
      })
      await waitForTimeout(100)
    })

    await act(async () => {
      liveQuery$.next(["a", "b", "c"])
      await waitForTimeout(200)
    })

    expectData(["a", "b", "c"])
  })

  it("survives invalidateQueries followed by a data change", async () => {
    const { liveQuery$, queryClient } = setup(
      ["live", "invalidate"],
      ["a", "b"],
      { networkMode: "always", gcTime: 0 },
    )

    await act(async () => {
      await waitForTimeout(100)
    })

    await act(async () => {
      queryClient.invalidateQueries({
        queryKey: ["live", "invalidate"],
        exact: true,
      })
      await waitForTimeout(100)
    })

    await act(async () => {
      liveQuery$.next(["a", "b", "c"])
      await waitForTimeout(200)
    })

    expectData(["a", "b", "c"])
  })
})
