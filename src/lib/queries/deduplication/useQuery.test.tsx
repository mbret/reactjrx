import { afterEach, describe, expect, it } from "vitest"
import { delay, interval, of, tap } from "rxjs"
import { render } from "@testing-library/react"
import React, { useEffect, useState } from "react"
import { cleanup } from "@testing-library/react"
import { useQuery } from "../useQuery"
import { Provider, useProvider } from "../Provider"
import { QueryStore } from "./useQueryStore"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  describe("Given a query that complete", () => {
    it("should remove query from the store", async () => {
      const query = async () => 2
      let _queryStore: QueryStore | undefined

      const Comp = () => {
        const { data } = useQuery(["foo"], query)

        const { queryStore } = useProvider()

        _queryStore = queryStore

        return <>{data}</>
      }

      const { findByText } = render(
        <React.StrictMode>
          <Provider>
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
        const query = async () =>
          new Promise((resolve) => setTimeout(resolve, Infinity))
        let _queryStore: QueryStore | undefined

        const Comp2 = () => {
          useQuery(["foo"], query)

          const { queryStore } = useProvider()

          _queryStore = queryStore

          return null
        }

        const Comp = () => {
          const [show, setShow] = useState(true)

          useEffect(() => {
            const timeout = setTimeout(() => {
              setShow(false)
            }, 1)

            return () => {
              clearTimeout(timeout)
            }
          })

          return show ? <Comp2 /> : <>unmounted</>
        }

        const { findByText } = render(
          <React.StrictMode>
            <Provider>
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
      it("should run observable only once", async () => {
        let tapped = 0
        let mounted = 0

        const Comp = () => {
          const query = () =>
            of(undefined).pipe(
              tap(() => {
                tapped++
              }),
              delay(999999)
            )

          useQuery(["foo"], query)
          useQuery(["foo"], query)

          useEffect(() => {
            mounted++
          }, [])

          return null
        }

        render(
          <React.StrictMode>
            <Provider>
              <Comp />
            </Provider>
          </React.StrictMode>
        )

        expect(tapped).toBe(mounted)
      })

      it("should run observable only once", async () => {
        const Comp = () => {
          const query = () => interval(1)

          const { data } = useQuery(["foo"], query)
          const { data: data2 } = useQuery(["foo"], query)

          return (
            <>
              {data},{data2}
            </>
          )
        }

        const { findByText } = render(
          <React.StrictMode>
            <Provider>
              <Comp />
            </Provider>
          </React.StrictMode>
        )

        expect(await findByText("1,1")).toBeDefined()
      })
    })
  })
})
