import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render } from "@testing-library/react"
import React, { act } from "react"
import { Subject } from "rxjs"
import { afterEach, describe, expect, it } from "vitest"
import { printQuery } from "../../tests/testUtils"
import { waitForTimeout } from "../../tests/utils"
import { QueryClientProvider$ } from "./QueryClientProvider$"
import { useQuery$ } from "./useQuery$"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  describe("Given a query subject", () => {
    describe("and a first value fired from the subject", () => {
      describe("when the key change", () => {
        it("should reset data to undefined and have fetchStatus as fetching and status as loading", async () => {
          const triggerSubject = new Subject()

          const Comp = ({ queryKey }: { queryKey: string }) => {
            "use no memo"
            const result = useQuery$({
              queryKey: [queryKey],
              queryFn: () => triggerSubject,
            })

            return (
              <>
                {printQuery(result, [
                  "data",
                  "error",
                  "isLoading",
                  "status",
                  "fetchStatus",
                ])}
              </>
            )
          }

          const client = new QueryClient()

          const { findByText, rerender } = render(
            <React.StrictMode>
              <QueryClientProvider client={client}>
                <QueryClientProvider$>
                  <Comp queryKey="1" />
                </QueryClientProvider$>
              </QueryClientProvider>
            </React.StrictMode>,
          )

          act(() => {
            triggerSubject.next(2)
          })

          expect(
            await findByText(
              printQuery({
                data: 2,
                error: null,
                fetchStatus: "fetching",
                isLoading: false,
                status: "success",
              }),
            ),
          ).toBeDefined()

          rerender(
            <React.StrictMode>
              <QueryClientProvider client={client}>
                <QueryClientProvider$>
                  <Comp queryKey="2" />
                </QueryClientProvider$>
              </QueryClientProvider>
            </React.StrictMode>,
          )

          expect(
            await findByText(
              printQuery({
                data: undefined,
                error: null,
                fetchStatus: "fetching",
                isLoading: true,
                status: "pending",
              }),
            ),
          ).toBeDefined()

          act(() => {
            triggerSubject.next(3)
          })

          expect(
            await findByText(
              printQuery({
                data: 3,
                error: null,
                fetchStatus: "fetching",
                isLoading: false,
                status: "success",
              }),
            ),
          ).toBeDefined()

          await act(async () => {
            triggerSubject.complete()

            await waitForTimeout(100)
          })

          // debug()

          expect(
            await findByText(
              printQuery({
                data: 3,
                error: null,
                fetchStatus: "idle",
                isLoading: false,
                status: "success",
              }),
            ),
          ).toBeDefined()
        })
      })
    })
  })
})
