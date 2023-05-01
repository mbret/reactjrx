import { afterEach, describe, expect, it } from "vitest"
import { interval, of } from "rxjs"
import { render } from "@testing-library/react"
import React, { memo, useEffect, useRef, useState } from "react"
import { cleanup } from "@testing-library/react"
import { useQuery } from "./useQuery"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  describe("Given a query that returns an interval stream", () => {
    it("should return consecutive results", async () => {
      const Comp = () => {
        const [values, setValues] = useState<(number | undefined)[]>([])

        const { data } = useQuery(() => interval(1))

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
      const [values, setValues] = useState<(number | undefined)[]>([])

      const { data } = useQuery(source)

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

        useQuery(of(renderCount.current))

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

        const { data } = useQuery(of(renderCount.current), {
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
})
