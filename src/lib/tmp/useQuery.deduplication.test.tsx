import { afterEach, describe, expect, it } from "vitest"
import { Subject, interval, map, tap } from "rxjs"
import { render, cleanup } from "@testing-library/react"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useQuery$ } from "./useQuery$"

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
              }),
              map(() => "foo")
            )

          useQuery$({ queryKey: ["foo"], queryFn: query })
          useQuery$({
            queryKey: ["foo"],
            queryFn: query,
            refetchOnMount: false
          })

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
          const query = () => interval(0)

          const { data } = useQuery$({ queryKey: ["foo"], queryFn: query })
          const { data: data2 } = useQuery$({
            queryKey: ["foo"],
            queryFn: query
          })

          console.log("render", data, data2)

          return (
            <>
              {data},{data2}
            </>
          )
        }

        const client = new QueryClient()

        client.getQueryCache().subscribe((d) => {
          console.log("cache", d.type)
        })

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
