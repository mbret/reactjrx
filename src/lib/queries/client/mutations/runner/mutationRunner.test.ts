import { describe, expect, test, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { sleep } from "../../../../../tests/utils"
import { QueryClient } from "../../createClient"
import { MutationObserver } from "../observers/MutationObserver"
import { MutationRunner } from "./MutationRunner"

describe("mutationObserver", () => {
  test("onUnsubscribe should not remove the current mutation observer if there is still a subscription", async () => {
    const client = new QueryClient()
    const mutationRunner = new MutationRunner({})
    const mutation = new MutationObserver(
      client,
      {
        mutationFn: async (text: string) => {
          await sleep(20)
          return text
        }
      },
      mutationRunner
    )

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
})
