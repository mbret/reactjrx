import { afterEach, describe, expect, it, vi } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { of } from "rxjs"
import { useQuery$ } from "./useQuery$"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { printQuery } from "../../tests/testUtils"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  describe("Given a query which runs once", () => {
    describe("and the query is an observable", () => {
      describe("when the query finished and is marked as stale", () => {
        it("should refetch", async () => {
          let value = 0

          const queryFn = vi.fn().mockImplementation(() => {
            return of(++value)
          })

          const staleTimeout = 1

          const Comp = () => {
            const result = useQuery$({
              queryKey: ["foo"],
              queryFn,
              staleTime: staleTimeout
            })

            return (
              <>{printQuery({ status: result.status, data: result.data })}</>
            )
          }

          const client = new QueryClient()

          const { findByText, rerender } = render(
            <QueryClientProvider client={client}>
              <Comp />
            </QueryClientProvider>
          )

          expect(
            await findByText(printQuery({ data: 1, status: "success" }))
          ).toBeDefined()

          expect(queryFn.mock.calls.length).toBe(1)

          rerender(
            <QueryClientProvider client={client}>
              unmounted query
            </QueryClientProvider>
          )

          rerender(
            <QueryClientProvider client={client}>
              <Comp />
            </QueryClientProvider>
          )

          expect(
            await findByText(printQuery({ data: 2, status: "success" }))
          ).toBeDefined()

          expect(queryFn.mock.calls.length).toBe(2)
        })
      })
    })
  })
})
