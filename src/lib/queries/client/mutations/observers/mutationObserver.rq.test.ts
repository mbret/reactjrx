import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { createQueryClient, sleep } from "../../../../../tests/utils"
import { type QueryClient } from "../../createClient"
import { MutationObserver } from "./MutationObserver"

describe("mutationObserver", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createQueryClient()
    queryClient.mount()
  })

  afterEach(() => {
    queryClient.clear()
  })

  test("onUnsubscribe should not remove the current mutation observer if there is still a subscription", async () => {
    const mutation = new MutationObserver(queryClient, {
      mutationFn: async (text: string) => {
        await sleep(20)
        return text
      }
    })

    const subscription1Handler = vi.fn()
    const subscription2Handler = vi.fn()

    const unsubscribe1 = mutation.subscribe(subscription1Handler)
    const unsubscribe2 = mutation.subscribe(subscription2Handler)

    void mutation.mutate("input")

    unsubscribe1()

    await waitFor(() => {
      // 1 call: loading
      expect(subscription1Handler).toBeCalledTimes(1)
      // 2 calls: loading, success
      expect(subscription2Handler).toBeCalledTimes(2)
    })

    // Clean-up
    unsubscribe2()
  })

  test("unsubscribe should remove observer to trigger GC", async () => {
    const mutation = new MutationObserver(queryClient, {
      mutationFn: async (text: string) => {
        await sleep(5)
        return text
      },
      gcTime: 10
    })

    const subscriptionHandler = vi.fn()

    const unsubscribe = mutation.subscribe(subscriptionHandler)

    await mutation.mutate("input")

    expect(queryClient.getMutationCache().findAll()).toHaveLength(1)

    unsubscribe()

    await waitFor(() => {
      expect(queryClient.getMutationCache().findAll()).toHaveLength(0)
    })
  })

  test("reset should remove observer to trigger GC", async () => {
    const mutation = new MutationObserver(queryClient, {
      mutationFn: async (text: string) => {
        await sleep(5)
        return text
      },
      gcTime: 10
    })

    const subscriptionHandler = vi.fn()

    const unsubscribe = mutation.subscribe(subscriptionHandler)

    await mutation.mutate("input")

    expect(queryClient.getMutationCache().findAll()).toHaveLength(1)

    mutation.reset()

    await waitFor(() =>
      { expect(queryClient.getMutationCache().findAll()).toHaveLength(0); }
    )

    unsubscribe()
  })
})