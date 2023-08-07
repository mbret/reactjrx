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
        const result = useQuery([queryKey], async () => {
          count++

          return count
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
        await findByText(`{"data":2,"error":undefined,"isLoading":false}`)
      ).toBeDefined()

      rerender(
        <React.StrictMode>
          <Comp queryKey="2" />
        </React.StrictMode>
      )

      // we have to account for strict mode
      expect(
        await findByText(`{"data":3,"error":undefined,"isLoading":false}`)
      ).toBeDefined()
    })
  })

  describe("Given a query subject", () => {
    describe("and a first value fired from the subject", () => {
      describe("when the key change", () => {
        it("should reset data to undefined and have isLoading as true", async () => {
          const triggerSubject = new Subject()

          const Comp = ({ queryKey }: { queryKey: string }) => {
            const result = useQuery([queryKey], triggerSubject)

            return <>{printQuery(result)}</>
          }

          const { findByText, rerender } = render(
            <React.StrictMode>
              <Comp queryKey="1" />
            </React.StrictMode>
          )

          triggerSubject.next(2)

          expect(
            await findByText(`{"data":2,"error":undefined,"isLoading":false}`)
          ).toBeDefined()

          rerender(
            <React.StrictMode>
              <Comp queryKey="2" />
            </React.StrictMode>
          )

          expect(
            await findByText(
              `{"data":undefined,"error":undefined,"isLoading":true}`
            )
          ).toBeDefined()

          triggerSubject.next(3)

          expect(
            await findByText(`{"data":3,"error":undefined,"isLoading":false}`)
          ).toBeDefined()
        })
      })
    })
  })
})
