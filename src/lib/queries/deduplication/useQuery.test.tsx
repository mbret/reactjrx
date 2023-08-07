import { afterEach, describe, expect, it, vi } from "vitest"
import { Subject, interval, merge, of, tap, timer } from "rxjs"
import { render, cleanup } from "@testing-library/react"
import React, { useEffect, useState } from "react"
import { useQuery } from "../useQuery"
import { Provider, useProvider } from "../Provider"
import { type QueryStore } from "./useQueryStore"
import { createClient } from "../client/createClient"

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
        const query = async () =>
          await new Promise((resolve) => setTimeout(resolve, 100))
        let _queryStore: QueryStore | undefined

        const Comp2 = () => {
          useQuery(["foo"], query)

          const { client } = useProvider()

          _queryStore = client.queryStore

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
            useQuery([], queryMock)
            useQuery([], queryMock)

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
        let mounted = 0

        const Comp = () => {
          const query = () =>
            merge(of(undefined), new Subject()).pipe(
              tap(() => {
                tapped++
              })
            )

          useQuery(["foo"], query)
          useQuery(["foo"], query)

          useEffect(() => {
            mounted++
          }, [])

          return null
        }

        const client = createClient()

        render(
          <React.StrictMode>
            <Provider client={client}>
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
