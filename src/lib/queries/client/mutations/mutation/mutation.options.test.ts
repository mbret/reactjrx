import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { type QueryClient } from "../../QueryClient"
import { createQueryClient, waitForTimeout } from "../../../../../tests/utils"
import { MutationObserver } from "../observers/MutationObserver"
import { waitFor } from "@testing-library/react"
import { noop } from "rxjs"
import { MutationCache } from "../cache/MutationCache"

describe("mutations", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createQueryClient()
    queryClient.mount()
  })

  afterEach(() => {
    queryClient.clear()
  })

  test("mutation onError callbacks should see updated options", async () => {
    const onError = vi.fn()

    const mutation = new MutationObserver(queryClient, {
      mutationFn: async () => {
        await waitForTimeout(10)

        throw new Error("error")
      },
      onError: () => {
        onError(1)
      }
    })

    void mutation.mutate().catch(noop)

    mutation.setOptions({
      onError: () => {
        onError(2)
      }
    })

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1)
    })

    expect(onError).toHaveBeenCalledWith(2)
  })

  test("mutation onSettled callbacks should see updated options", async () => {
    const onSettled = vi.fn()

    const mutation = new MutationObserver(queryClient, {
      mutationFn: async () => {
        return "update"
      },
      onSettled: () => {
        onSettled(1)
      }
    })

    void mutation.mutate()

    mutation.setOptions({
      onSettled: () => {
        onSettled(2)
      }
    })

    await waitFor(() => {
      expect(onSettled).toHaveBeenCalledTimes(1)
    })

    expect(onSettled).toHaveBeenCalledWith(2)
  })

  test("mutation onMutate callbacks should see updated options", async () => {
    const onMutate = vi.fn()

    const queryClient2 = createQueryClient({
      mutationCache: new MutationCache({
        onMutate: async () => {
          await waitForTimeout(10)

          return ""
        }
      })
    })

    const mutation = new MutationObserver(queryClient2, {
      mutationFn: async () => {
        return "update"
      },
      onMutate: () => {
        onMutate(1)
      }
    })

    void mutation.mutate()

    mutation.setOptions({
      onMutate: () => {
        onMutate(2)
      }
    })

    await waitFor(() => {
      expect(onMutate).toHaveBeenCalledTimes(1)
    })

    expect(onMutate).toHaveBeenCalledWith(2)
  })
})
