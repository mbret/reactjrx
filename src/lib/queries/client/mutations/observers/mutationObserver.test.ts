import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import {
  createQueryClient,
  sleep,
  waitForTimeout
} from "../../../../../tests/utils"
import { QueryClient } from "../../QueryClient"
import { MutationObserver } from "./MutationObserver"
import { noop } from "rxjs"

describe("mutationObserver", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createQueryClient()
    queryClient.mount()
  })

  afterEach(() => {
    queryClient.clear()
  })

  test("should still call the previous concat mutation if we cancel the last one", async () => {
    const mutationFn = vi.fn().mockImplementation(async (text: string) => {
      await sleep(1)
      return text
    })

    const mutation = new MutationObserver(queryClient, {
      mutationFn,
      mapOperator: "concat",
      gcTime: 1
    })

    void mutation.mutate("a")
    void mutation.mutate("b")
    void mutation.mutate("c")

    // cancel last one
    mutation.reset()

    await waitForTimeout(10)

    expect(mutationFn).toBeCalledTimes(2)
    expect(mutationFn.mock.calls).toEqual([["a"], ["b"]])
  })

  test("should pass default options to the mutations", () => {
    const newClient = new QueryClient({
      defaultOptions: {
        mutations: {
          networkMode: "always"
        }
      }
    })

    const observer = new MutationObserver(newClient, {
      mutationKey: ["foo"]
    })

    observer.mutate().then(noop).catch(noop)

    expect(
      newClient.getMutationCache().find({ mutationKey: ["foo"] })?.options
        .networkMode
    ).toBe("always")
  })
})
