import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render } from "@testing-library/react"
import React, { act, StrictMode } from "react"
import { of } from "rxjs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { printQuery } from "../../tests/testUtils"
import { QueryClientProvider$ } from "./QueryClientProvider$"
import { useQuery$ } from "./useQuery$"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  describe("Given a query which runs once", () => {
    describe("and the query is an observable", () => {
      describe("when the query finished and is marked as stale", () => {
        it("should refetch", async () => {
          let value = 0
          let called = 0

          const queryFnMock = () => {
            called++
            return of(++value)
          }

          const staleTimeout = 1

          const Comp = () => {
            const result = useQuery$({
              queryKey: ["foo"],
              queryFn: () => {
                return queryFnMock()
              },
              staleTime: staleTimeout,
            })

            return (
              <>{printQuery({ status: result.status, data: result.data })}</>
            )
          }

          const Main = () => {
            const [showComp, setShowComp] = React.useState(true)

            return (
              <>
                {showComp && <Comp />}
                <button
                  type="button"
                  onClick={() => {
                    setShowComp((v) => !v)
                  }}
                >
                  toggle
                </button>
              </>
            )
          }

          const client = new QueryClient()

          const { findByText, getByText } = render(
            <StrictMode>
              <QueryClientProvider client={client}>
                <QueryClientProvider$>
                  <Main />
                </QueryClientProvider$>
              </QueryClientProvider>
            </StrictMode>,
          )

          // strict mode runs 2 times
          expect(
            await findByText(printQuery({ data: 2, status: "success" })),
          ).toBeDefined()

          expect(called).toBe(2)

          act(() => {
            getByText("toggle").click()
          })

          act(() => {
            getByText("toggle").click()
          })

          // strict mode runs 2 times
          expect(
            await findByText(printQuery({ data: 4, status: "success" })),
          ).toBeDefined()

          expect(called).toBe(4)
        })
      })
    })
  })
})
