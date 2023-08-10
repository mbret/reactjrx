import { afterEach, describe, expect, it, vi } from "vitest"
import { Subject, interval, tap, timer } from "rxjs"
import { render, cleanup } from "@testing-library/react"
import React, { useEffect, useState } from "react"
import { useQuery } from "./useQuery"
import { Provider, useProvider } from "./Provider"
import { createClient } from "../client/createClient"
import { type QueryFnStore } from "../client/types"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  describe("Given a query that complete", () => {
    it("should remove query from the store", async () => {
      const query = async () => 2
      let _queryStore: QueryFnStore | undefined

      const Comp = () => {
        const { data } = useQuery({ queryKey: ["foo"], queryFn: query })

        const { client } = useProvider()

        _queryStore = client.queryStore

        return <>{data}</>
      }

      const client = createClient()

      const { findByText } = render(
        <React.StrictMode>
          <Provider client={client}>
            <Comp />
          </Provider>
        </React.StrictMode>
      )
      expect(_queryStore?.size).toBe(1)

      expect(await findByText("2")).toBeDefined()

      expect(_queryStore?.size).toBe(0)
    })
  })

  describe("Given a query that takes time to finish", () => {
    describe("when useQuery unmount", () => {
      it("should remove query from the store", async () => {
        const query = async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        let _queryStore: QueryFnStore | undefined

        const Comp2 = () => {
          useQuery({ queryKey: ["foo"], queryFn: query })

          const { client } = useProvider()

          _queryStore = client.queryStore

          return null
        }

        const Comp = () => {
          const [show, setShow] = useState(true)

          useEffect(() => {
            const timeout = setTimeout(() => {
              setShow(false)
            }, 10)

            return () => {
              clearTimeout(timeout)
            }
          })

          return show ? <Comp2 /> : <>unmounted</>
        }

        const client = createClient()

        const { findByText } = render(
          <React.StrictMode>
            <Provider client={client}>
              <Comp />
            </Provider>
          </React.StrictMode>
        )

        expect(_queryStore?.size).toBe(1)

        expect(await findByText("unmounted")).toBeDefined()

        expect(_queryStore?.size).toBe(0)
      })
    })

    describe("when a second useQuery is mounted with the same key", () => {
      describe("and the key is empty", () => {
        it("it should call function each time individually", () => {
          const queryMock = vi.fn().mockImplementation(() => timer(100))

          const Comp = () => {
            useQuery({ queryKey: [], queryFn: queryMock })
            useQuery({ queryKey: [], queryFn: queryMock })

            return null
          }

          const client = createClient()

          render(
            <Provider client={client}>
              <Comp />
            </Provider>
          )

          expect(queryMock).toHaveBeenCalledTimes(2)
        })
      })

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
          useQuery({ queryKey: ["foo"], queryFn: query })

          return null
        }

        const client = createClient()

        render(
          <Provider client={client}>
            <Comp />
          </Provider>
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

      it("should run observable only once", async () => {
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

        const client = createClient()

        const { findByText } = render(
          <React.StrictMode>
            <Provider client={client}>
              <Comp />
            </Provider>
          </React.StrictMode>
        )

        expect(await findByText("1,1")).toBeDefined()
      })
    })
  })
})
