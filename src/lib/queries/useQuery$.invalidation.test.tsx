import { afterEach, describe, expect, it, vi } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { of } from "rxjs"
import { useQuery$ } from "./useQuery$"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { printQuery } from "../../tests/testUtils"
import { QueryClientProvider$ } from "./QueryClientProvider$"
import React from "react"
import { waitForTimeout } from "../../tests/utils"

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

          const Main = () => {
            const [showComp, setShowComp] = React.useState(true)

            console.log("showComp", showComp)
            return (
              <>
                {showComp && <Comp />}
                <button onClick={() => setShowComp(false)}>toggle</button>
              </>
            )
          }

          const client = new QueryClient()

          const { findByText, getByText } = render(
            <QueryClientProvider client={client}>
              <QueryClientProvider$>
                <Main />
              </QueryClientProvider$>
            </QueryClientProvider>
          )

          expect(
            await findByText(printQuery({ data: 1, status: "success" }))
          ).toBeDefined()

          // expect(queryFn.mock.calls.length).toBe(1)

          // getByText('toggle').click()

          // await waitForTimeout(10)

          // getByText('toggle').click()

          // expect(
          //   await findByText(printQuery({ data: 2, status: "success" }))
          // ).toBeDefined()

          // expect(queryFn.mock.calls.length).toBe(2)
        })
      })
    })
  })
})
