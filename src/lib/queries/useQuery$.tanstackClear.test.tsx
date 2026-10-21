import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render } from "@testing-library/react"
import { act, StrictMode } from "react"
import { of } from "rxjs"
import { afterEach, describe, expect, it } from "vitest"
import { printQuery } from "../../tests/testUtils"
import { useQuery$ } from "./useQuery$"

afterEach(() => {
  cleanup()
})

describe("Given a query removed from the TanStack cache", () => {
  it("should refetch when an observer mounts again", async () => {
    let calls = 0

    const Comp = () => {
      "use no memo"

      const result = useQuery$({
        queryKey: ["books"],
        queryFn: () => {
          calls++
          return of(calls)
        },
      })

      return <>{printQuery({ status: result.status, data: result.data })}</>
    }

    const tanstackClient = new QueryClient()

    const tree = (
      <StrictMode>
        <QueryClientProvider client={tanstackClient}>
          <Comp />
        </QueryClientProvider>
      </StrictMode>
    )

    const { findByText, unmount } = render(tree)

    expect(
      await findByText(printQuery({ data: 2, status: "success" })),
    ).toBeDefined()
    expect(calls).toBe(2)

    await act(async () => {
      tanstackClient.clear()
    })

    unmount()

    const { findByText: findAfterRemount } = render(tree)

    expect(
      await findAfterRemount(printQuery({ data: 4, status: "success" })),
    ).toBeDefined()
    expect(calls).toBe(4)
  })
})
