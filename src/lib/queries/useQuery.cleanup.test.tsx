import { afterEach, describe, expect, it } from "vitest"
import { finalize, timer } from "rxjs"
import { render, cleanup } from "@testing-library/react"
import { StrictMode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useQuery$ } from "./useQuery$"
import { waitForTimeout } from "../../tests/utils"

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
            <Comp />
          </QueryClientProvider>
        </StrictMode>
      )

      unmount()

      await waitForTimeout(10)

      // 2 because of strict mode
      expect(tapped).toBe(2)
    })
  })
})
