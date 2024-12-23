import { afterEach, describe, expect, it } from "vitest"
import { Subject } from "rxjs"
import { render, cleanup } from "@testing-library/react"
import React from "react"
import { useQuery } from "./useQuery"
import { printQuery } from "../../../../tests/testUtils"
import { QueryClient, QueryClientProvider } from "../../../.."
import { waitForTimeout } from "../../../../tests/utils"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  describe("Given a query that returns a value that increment every time", () => {
    it("should re-run the query when the key change", async () => {
      let count = 0

      const Comp = ({ queryKey }: { queryKey: string }) => {
        const result = useQuery({
          queryKey: [queryKey],
          queryFn: async () => {
            count++

            return count
          }
        })

        return (
          <>
            {printQuery(result, [
              "data",
              "error",
              "isLoading",
              "status",
              "fetchStatus"
            ])}
          </>
        )
      }

      const client = new QueryClient()

      const { findByText, rerender } = render(
        <React.StrictMode>
          <QueryClientProvider client={client}>
            <Comp queryKey="1" />
          </QueryClientProvider>
        </React.StrictMode>
      )

      // we have to account for strict mode but
      // - because we don't have data yet the next request
      // will not cancel the previous one and therefore be ignored
      expect(
        await findByText(
          printQuery({
            data: 1,
            error: null,
            isLoading: false,
            status: "success",
            fetchStatus: "idle"
          })
        )
      ).toBeDefined()

      rerender(
        <React.StrictMode>
          <QueryClientProvider client={client}>
            <Comp queryKey="2" />
          </QueryClientProvider>
        </React.StrictMode>
      )

      // we have to account for strict mode
      expect(
        await findByText(
          printQuery({
            data: 2,
            error: null,
            isLoading: false,
            status: "success",
            fetchStatus: "idle"
          })
        )
      ).toBeDefined()
    })
  })

  describe("Given a query subject", () => {
    describe("and a first value fired from the subject", () => {
      describe("when the key change", () => {
        it("should reset data to undefined and have fetchStatus as fetching and status as loading", async () => {
          const triggerSubject = new Subject()

          const Comp = ({ queryKey }: { queryKey: string }) => {
            const result = useQuery({
              queryKey: [queryKey],
              queryFn: triggerSubject
            })

            return (
              <>
                {printQuery(result, [
                  "data",
                  "error",
                  "isLoading",
                  "status",
                  "fetchStatus"
                ])}
              </>
            )
          }

          const client = new QueryClient()

          const { findByText, rerender, debug } = render(
            <React.StrictMode>
              <QueryClientProvider client={client}>
                <Comp queryKey="1" />
              </QueryClientProvider>
            </React.StrictMode>
          )

          triggerSubject.next(2)

          expect(
            await findByText(
              printQuery({
                data: 2,
                error: null,
                fetchStatus: "fetching",
                isLoading: false,
                status: "success"
              })
            )
          ).toBeDefined()

          rerender(
            <React.StrictMode>
              <QueryClientProvider client={client}>
                <Comp queryKey="2" />
              </QueryClientProvider>
            </React.StrictMode>
          )

          expect(
            await findByText(
              printQuery({
                data: undefined,
                error: null,
                fetchStatus: "fetching",
                isLoading: true,
                status: "pending"
              })
            )
          ).toBeDefined()

          triggerSubject.next(3)

          expect(
            await findByText(
              printQuery({
                data: 3,
                error: null,
                fetchStatus: "fetching",
                isLoading: false,
                status: "success"
              })
            )
          ).toBeDefined()

          triggerSubject.complete()

          await waitForTimeout(100)

          debug()

          expect(
            await findByText(
              printQuery({
                data: 3,
                error: null,
                fetchStatus: "idle",
                isLoading: false,
                status: "success"
              })
            )
          ).toBeDefined()
        })
      })
    })
  })
})
