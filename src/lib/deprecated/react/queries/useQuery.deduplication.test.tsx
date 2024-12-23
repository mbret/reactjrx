import { afterEach, describe, expect, it } from "vitest"
import { Subject, interval, tap } from "rxjs"
import { render, cleanup } from "@testing-library/react"
import React from "react"
import { useQuery } from "./useQuery"
import { QueryClientProvider } from "../QueryClientProvider"
import { QueryClient } from "../../client/QueryClient"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  describe("Given a query that takes time to finish", () => {
    describe("when a second useQuery is mounted with the same key", () => {
      it("should run observable only once", async () => {
        let tapped = 0
        const trigger = new Subject<void>()

        const Comp = () => {
          const query = () =>
            trigger.pipe(
              tap(() => {
                tapped++
              })
            )

          useQuery({ queryKey: ["foo"], queryFn: query })
          useQuery({ queryKey: ["foo"], queryFn: query, refetchOnMount: false })

          return null
        }

        const client = new QueryClient()

        render(
          <QueryClientProvider client={client}>
            <Comp />
          </QueryClientProvider>
        )

        expect(tapped).toBe(0)

        trigger.next()

        expect(tapped).toBe(1)

        /**
         * Because the stream never finished (subject).
         * it should stay in the deduplication layer and always
         * run once
         */
        trigger.next()

        expect(tapped).toBe(2)
      })

      it("should also run observable only once", async () => {
        const Comp = () => {
          const query = () => interval(1)

          const { data } = useQuery({ queryKey: ["foo"], queryFn: query })
          const { data: data2 } = useQuery({
            queryKey: ["foo"],
            queryFn: query
          })

          return (
            <>
              {data},{data2}
            </>
          )
        }

        const client = new QueryClient()

        const { findByText } = render(
          <React.StrictMode>
            <QueryClientProvider client={client}>
              <Comp />
            </QueryClientProvider>
          </React.StrictMode>
        )

        expect(await findByText("1,1")).toBeDefined()
      })
    })
  })
})
