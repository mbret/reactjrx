import { afterEach, describe, expect, it } from "vitest"
import { Subject, interval, of, tap } from "rxjs"
import { render, cleanup } from "@testing-library/react"
import React, { memo, useEffect, useRef, useState } from "react"
import { useQuery } from "./useQuery"
import { printQuery } from "../../../tests/testUtils"
import { useSubscribe } from "../../binding/useSubscribe"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  describe("Given a query that returns an interval stream", () => {
    it("should return consecutive results", async () => {
      const Comp = () => {
        const [values, setValues] = useState<Array<number | undefined>>([])

        const { data } = useQuery({ queryFn: () => interval(1) })

        useEffect(() => {
          data && setValues((v) => [...v, data])
        }, [data])

        return <>{values.join(",")}</>
      }

      const { findByText } = render(
        <React.StrictMode>
          <Comp />
        </React.StrictMode>
      )

      expect(await findByText("1,2,3")).toBeDefined()
    })
  })

  it("should return consecutive results", async () => {
    const source = interval(1)

    const Comp = () => {
      const [values, setValues] = useState<Array<number | undefined>>([])

      const { data } = useQuery({ queryFn: source })

      useEffect(() => {
        data && setValues((v) => [...v, data])
      }, [data])

      return <>{values.join(",")}</>
    }

    const { findByText } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>
    )

    expect(await findByText("1,2,3")).toBeDefined()
  })

  describe("Given a new source every render", () => {
    it("should infinite render and throw", async () => {
      const Comp = () => {
        const renderCount = useRef(0)

        useQuery({ queryFn: of(renderCount.current) })

        useEffect(() => {
          renderCount.current++

          if (renderCount.current > 20) {
            throw new Error("too many render")
          }
        })

        return null
      }

      expect(() =>
        render(
          <React.StrictMode>
            <Comp />
          </React.StrictMode>
        )
      ).to.toThrowError("too many render")
    })

    it("should disable query once render count reach 10 and therefore return 10", async () => {
      const Comp = memo(() => {
        const renderCount = useRef(0)

        const { data } = useQuery({
          queryFn: of(renderCount.current),
          enabled: renderCount.current < 11
        })

        useEffect(() => {
          renderCount.current++

          // we use a margin because of strict mode / concurrency
          if (renderCount.current > 20) {
            throw new Error("too many render")
          }
        })

        return <>{data}</>
      })

      const { findByText } = render(
        <React.StrictMode>
          <Comp />
        </React.StrictMode>
      )

      expect(await findByText("10")).toBeDefined()
    })
  })

  describe("Given a query that change every render and a stable key", () => {
    describe("when user refetch said query", () => {
      it("foobar should return result of latest query instance", async () => {
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
            refetch()
          }, [query, refetch])

          return <>{printQuery(result)}</>
        }

        const { findByText } = render(
          <React.StrictMode>
            <Comp />
          </React.StrictMode>
        )

        expect(
          await findByText(
            printQuery({ data: 1, isLoading: false, error: undefined })
          )
        ).toBeDefined()

        changeQueryTrigger.next()

        expect(
          await findByText(
            printQuery({ data: 2, isLoading: false, error: undefined })
          )
        ).toBeDefined()
      })
    })
  })
})
