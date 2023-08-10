import { afterEach, describe, expect, it } from "vitest"
import { Subject } from "rxjs"
import { render, cleanup } from "@testing-library/react"
import React from "react"
import { useQuery } from "../../react/useQuery"
import { printQuery } from "../../../../tests/testUtils"

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

        return <>{printQuery(result)}</>
      }

      const { findByText, rerender } = render(
        <React.StrictMode>
          <Comp queryKey="1" />
        </React.StrictMode>
      )

      // we have to account for strict mode
      expect(
        await findByText(
          printQuery({
            data: 2,
            error: undefined,
            isLoading: false,
            status: "success",
            fetchStatus: "idle"
          })
        )
      ).toBeDefined()

      rerender(
        <React.StrictMode>
          <Comp queryKey="2" />
        </React.StrictMode>
      )

      // we have to account for strict mode
      expect(
        await findByText(
          printQuery({
            data: 3,
            error: undefined,
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

            return <>{printQuery(result)}</>
          }

          const { findByText, rerender } = render(
            <React.StrictMode>
              <Comp queryKey="1" />
            </React.StrictMode>
          )

          triggerSubject.next(2)

          expect(
            await findByText(
              printQuery({
                data: 2,
                error: undefined,
                fetchStatus: "idle",
                isLoading: false,
                status: "success"
              })
            )
          ).toBeDefined()

          rerender(
            <React.StrictMode>
              <Comp queryKey="2" />
            </React.StrictMode>
          )

          expect(
            await findByText(
              printQuery({
                data: undefined,
                error: undefined,
                fetchStatus: "fetching",
                isLoading: true,
                status: "loading"
              })
            )
          ).toBeDefined()

          triggerSubject.next(3)

          expect(
            await findByText(
              printQuery({
                data: 3,
                error: undefined,
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
