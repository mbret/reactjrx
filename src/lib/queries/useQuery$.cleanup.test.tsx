import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { cleanup, render } from "@testing-library/react"
import { act, StrictMode } from "react"
import { EMPTY, finalize, timer } from "rxjs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { waitForTimeout } from "../../tests/utils"
import { QueryClient$, QueryClientProvider$ } from "./QueryClientProvider$"
import { useQuery$ } from "./useQuery$"

afterEach(() => {
  cleanup()
})

describe("Given a long observable", () => {
  describe("when the component unmount", () => {
    it("should unsubscribe to the observable", async () => {
      let tapped = 0

      const Comp = () => {
        useQuery$({
          queryKey: ["foo"],
          queryFn: () =>
            timer(99999).pipe(
              finalize(() => {
                tapped++
              }),
            ),
        })

        return null
      }

      const client = new QueryClient()

      const { unmount } = render(
        <StrictMode>
          <QueryClientProvider client={client}>
            <QueryClientProvider$>
              <Comp />
            </QueryClientProvider$>
          </QueryClientProvider>
        </StrictMode>,
      )

      unmount()

      await act(async () => {
        await waitForTimeout(15)
      })

      // 2 because of strict mode
      expect(tapped).toBe(2)
    })

    it("clears QueryClient$ cache and stops the in-flight stream on unmount", async () => {
      let finalizeCount = 0
      const queryClient$ = new QueryClient$(new QueryClient())

      const Comp = () => {
        useQuery$({
          queryKey: ["long-running-cache"],
          queryFn: () =>
            timer(99999).pipe(
              finalize(() => {
                finalizeCount++
              }),
            ),
        })

        return null
      }

      const tanstackClient = new QueryClient()

      const { unmount } = render(
        <StrictMode>
          <QueryClientProvider client={tanstackClient}>
            <QueryClientProvider$ client={queryClient$}>
              <Comp />
            </QueryClientProvider$>
          </QueryClientProvider>
        </StrictMode>,
      )

      await act(async () => {
        await waitForTimeout(15)
      })

      expect(queryClient$.queryMap.size).toBe(1)

      await act(async () => {
        unmount()
      })

      await act(async () => {
        await waitForTimeout(15)
      })

      expect(queryClient$.queryMap.size).toBe(0)
      // StrictMode mount / unmount / remount / final unmount → two shared streams torn down
      expect(finalizeCount).toBe(2)
    })
  })
})

describe("Observable completes without emitting", () => {
  /**
   * Regression: calling `cancelQueries` from this path raced with TanStack’s own
   * fetch lifecycle (persist restore + Strict Mode) and could leave queries stuck.
   * Completing with no value still ends via `reject(CancelledError)` only.
   */
  it("does not call queryClient.cancelQueries", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const queryClient = new QueryClient()
    const cancelQueriesSpy = vi.spyOn(queryClient, "cancelQueries")

    const Comp = () => {
      useQuery$({
        queryKey: ["empty-complete"],
        queryFn: () => EMPTY,
        retry: false,
      })

      return null
    }

    render(
      <QueryClientProvider client={queryClient}>
        <QueryClientProvider$>
          <Comp />
        </QueryClientProvider$>
      </QueryClientProvider>,
    )

    await act(async () => {
      await waitForTimeout(50)
    })

    expect(cancelQueriesSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('["empty-complete"]'),
    )

    cancelQueriesSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it("does not call cancelQueries under PersistQueryClientProvider (isRestoring window)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const queryClient = new QueryClient()
    const cancelQueriesSpy = vi.spyOn(queryClient, "cancelQueries")

    const persister = {
      persistClient: vi.fn(async () => {}),
      restoreClient: vi.fn(async () => undefined),
      removeClient: vi.fn(async () => {}),
    }

    const Comp = () => {
      useQuery$({
        queryKey: ["persist-empty"],
        queryFn: () => EMPTY,
        retry: false,
      })

      return null
    }

    render(
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 86_400_000 }}
      >
        <QueryClientProvider$>
          <Comp />
        </QueryClientProvider$>
      </PersistQueryClientProvider>,
    )

    await act(async () => {
      await waitForTimeout(100)
    })

    expect(cancelQueriesSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('["persist-empty"]'),
    )

    cancelQueriesSpy.mockRestore()
    warnSpy.mockRestore()
  })
})

describe("Given an observable that completes", () => {
  it("should remove it from cache and finalize the subscription", async () => {
    let tapped = 0

    const Comp = () => {
      useQuery$({
        queryKey: ["foo"],
        queryFn: () => {
          return timer(10).pipe(
            finalize(() => {
              tapped++
            }),
          )
        },
      })

      return null
    }

    const client = new QueryClient()
    const reactJrxQueryClient = new QueryClient$(client)

    render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <QueryClientProvider$ client={reactJrxQueryClient}>
            <Comp />
          </QueryClientProvider$>
        </QueryClientProvider>
      </StrictMode>,
    )

    await act(async () => {
      await waitForTimeout(15)
    })

    expect(tapped).toBe(2)
    expect(reactJrxQueryClient.queryMap.size).toBe(0)
  })
})
