import { afterEach, describe, expect, it } from "vitest"
import { Subject, interval, noop, takeWhile, tap } from "rxjs"
import { render, cleanup } from "@testing-library/react"
import React, { memo, useEffect, useState } from "react"
import { useQuery } from "./useQuery"
import { printQuery } from "../../../../tests/testUtils"
import { useSubscribe } from "../../../binding/useSubscribe"
import { QueryClient, QueryClientProvider } from "../../../.."
import { waitForTimeout } from "../../../../tests/utils"

afterEach(() => {
  cleanup()
})

describe("useQuery.observable", () => {
  describe("Given a query that returns an interval stream", () => {
    it("should return consecutive results", async () => {
      const Comp = () => {
        const [values, setValues] = useState<Array<number | undefined>>([])

        const { data } = useQuery({ queryKey: [], queryFn: () => interval(1) })

        useEffect(() => {
          data && setValues((v) => [...v, data])
        }, [data])

        return <>{JSON.stringify(values)}</>
      }

      const client = new QueryClient()

      const { findByText } = render(
        <React.StrictMode>
          <QueryClientProvider client={client}>
            <Comp />
          </QueryClientProvider>
        </React.StrictMode>
      )

      expect(await findByText(JSON.stringify([1, 2, 3]))).toBeDefined()
    })
  })

  it("should return consecutive results", async () => {
    // interval big enough so react does not skip some render
    const source = interval(5).pipe(takeWhile((value) => value < 5, true))
    const states: any = []

    const Comp = memo(() => {
      const state = useQuery({ queryKey: [], queryFn: source })

      const { data } = state

      states.push(state)

      return <>{data}</>
    })

    const client = new QueryClient()

    const { findByText } = render(
      <QueryClientProvider client={client}>
        <Comp />
      </QueryClientProvider>
    )

    expect(await findByText("5")).toBeDefined()

    expect(states[0]).toMatchObject({
      data: undefined,
      status: "pending",
      fetchStatus: "fetching"
    })
    expect(states[1]).toMatchObject({
      data: 0,
      fetchStatus: "fetching"
    })
    expect(states[2]).toMatchObject({
      data: 1,
      fetchStatus: "fetching"
    })
    expect(states[3]).toMatchObject({
      data: 2,
      fetchStatus: "fetching"
    })
    expect(states[4]).toMatchObject({
      data: 3,
      fetchStatus: "fetching"
    })
    expect(states[5]).toMatchObject({
      data: 4,
      fetchStatus: "fetching"
    })
    expect(states[6]).toMatchObject({
      data: 5,
      fetchStatus: "idle",
      status: "success"
    })
  })

  it("should return consecutive results", async () => {
    const source = new Subject<number>()

    const Comp = () => {
      const [values, setValues] = useState<Array<number | undefined>>([])

      const queryResult = useQuery({ queryKey: [], queryFn: source })

      const { data } = queryResult

      useEffect(() => {
        data && setValues((v) => [...v, data])
      }, [data])

      return <>{JSON.stringify(values)}</>
    }

    const client = new QueryClient()

    const { findByText } = render(
      <React.StrictMode>
        <QueryClientProvider client={client}>
          <Comp />
        </QueryClientProvider>
      </React.StrictMode>
    )

    source.next(3)

    await waitForTimeout(1)

    source.next(2)

    await waitForTimeout(1)

    source.next(1)

    expect(await findByText(JSON.stringify([3, 2, 1]))).toBeDefined()
  })

  describe("Given a query that change every render and a stable key", () => {
    describe("when user refetch said query", () => {
      it("should return result of latest query instance", async () => {
        const changeQueryTrigger = new Subject<void>()

        const Comp = () => {
          const [query, setQuery] = useState(() => async () => 1)

          const result = useQuery({
            queryFn: query,
            queryKey: ["foo"]
          })

          const { refetch } = result

          useSubscribe(
            changeQueryTrigger.pipe(
              tap(() => {
                setQuery(() => async () => 2)
              })
            )
          )

          useEffect(() => {
            refetch().catch(noop)
          }, [query, refetch])

          return (
            <>
              {printQuery(result, [
                "data",
                "error",
                "fetchStatus",
                "isLoading",
                "status"
              ])}
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

        expect(
          await findByText(
            printQuery({
              data: 1,
              error: null,
              fetchStatus: "idle",
              isLoading: false,
              status: "success"
            })
          )
        ).toBeDefined()

        changeQueryTrigger.next()

        expect(
          await findByText(
            printQuery({
              data: 2,
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
