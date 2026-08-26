import { act, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import {
  createLiveQuerySource,
  createQueryClient,
  createWrapper,
  liveQueryOptions,
} from "../../tests/liveQuery"
import { waitForTimeout } from "../../tests/utils"
import { useQuery$ } from "./useQuery$"

function setup(queryKey: string[], initialItems: string[]) {
  const { liveQuery$, queryFn } = createLiveQuerySource(initialItems)
  const queryClient = createQueryClient()

  function List() {
    const { data } = useQuery$({
      ...liveQueryOptions,
      queryKey,
      queryFn,
    })

    return <span data-testid="data">{JSON.stringify(data)}</span>
  }

  let toggle = () => {}

  function Host() {
    const [visible, setVisible] = useState(true)
    toggle = () => setVisible((v) => !v)

    return visible ? <List /> : <span data-testid="hidden" />
  }

  render(<Host />, { wrapper: createWrapper(queryClient) })

  return { liveQuery$, toggle: () => toggle() }
}

const expectData = (items: string[]) =>
  expect(screen.getByTestId("data").textContent).toBe(JSON.stringify(items))

describe("useQuery$ unmount / remount", () => {
  it("stays reactive after hide/show then adding an item", {
    timeout: 3000,
  }, async () => {
    const { liveQuery$, toggle } = setup(["unmount", "add"], ["a", "b"])

    await act(async () => {
      await waitForTimeout(100)
    })

    expectData(["a", "b"])

    await act(async () => {
      toggle()
      toggle()
      await waitForTimeout(200)
    })

    expectData(["a", "b"])

    await act(async () => {
      liveQuery$.next(["a", "b", "c"])
      await waitForTimeout(200)
    })

    expectData(["a", "b", "c"])
  })

  it("stays reactive after hide/show then removing an item", {
    timeout: 3000,
  }, async () => {
    const { liveQuery$, toggle } = setup(["unmount", "remove"], ["a", "b", "c"])

    await act(async () => {
      await waitForTimeout(100)
    })

    expectData(["a", "b", "c"])

    await act(async () => {
      toggle()
      toggle()
      await waitForTimeout(200)
    })

    await act(async () => {
      liveQuery$.next(["a", "c"])
      await waitForTimeout(200)
    })

    expectData(["a", "c"])
  })

  it("stays reactive after multiple hide/show cycles", {
    timeout: 5000,
  }, async () => {
    const { liveQuery$, toggle } = setup(["unmount", "multi"], ["a"])

    await act(async () => {
      await waitForTimeout(100)
    })

    expectData(["a"])

    for (let i = 0; i < 5; i++) {
      await act(async () => {
        toggle()
        toggle()
        await waitForTimeout(50)
      })
    }

    expectData(["a"])

    await act(async () => {
      liveQuery$.next(["a", "b"])
      await waitForTimeout(200)
    })

    expectData(["a", "b"])
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
    const { liveQuery$, toggle } = setup(["unmount", "stale-guard"], ["a"])

    await act(async () => {
      await waitForTimeout(100)
    })

    expectData(["a"])

    await act(async () => {
      liveQuery$.next(["a", "b"])
      await waitForTimeout(100)
    })

    expectData(["a", "b"])

    liveQuery$.next(["a", "b", "c"])

    await act(async () => {
      toggle()
      toggle()
      await waitForTimeout(200)
    })

    expectData(["a", "b", "c"])

    await act(async () => {
      liveQuery$.next(["a", "b", "c", "d"])
      await waitForTimeout(200)
    })

    expectData(["a", "b", "c", "d"])
  })
})
