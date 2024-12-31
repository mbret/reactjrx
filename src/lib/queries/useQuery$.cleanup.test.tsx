import { afterEach, describe, expect, it } from "vitest"
import { finalize, timer } from "rxjs"
import { render, cleanup } from "@testing-library/react"
import { StrictMode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useQuery$ } from "./useQuery$"
import { waitForTimeout } from "../../tests/utils"
import { QueryClient$, QueryClientProvider$ } from "./QueryClientProvider$"

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
              })
            )
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
        </StrictMode>
      )

      unmount()

      await waitForTimeout(15)

      // 2 because of strict mode
      expect(tapped).toBe(2)
    })
  })
})

describe("Given an observable that completes", () => {
  it("should remove it from cache and finalize the subscription", async () => {
    let tapped = 0

    const Comp = () => {
      useQuery$({
        queryKey: ["foo"],
        queryFn: () => {
          console.log("fn")
          return timer(10).pipe(
            finalize(() => {
              tapped++
            })
          )
        }
      })

      return null
    }

    const client = new QueryClient()
    const reactJrxQueryClient = new QueryClient$()

    render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <QueryClientProvider$ client={reactJrxQueryClient}>
            <Comp />
          </QueryClientProvider$>
        </QueryClientProvider>
      </StrictMode>
    )

    await waitForTimeout(15)

    expect(tapped).toBe(2)
    expect(reactJrxQueryClient.queryMap.size).toBe(0)
  })
})
