import { afterEach, describe, expect, it } from "vitest"
import { interval, of } from "rxjs"
import { render } from "@testing-library/react"
import React, { memo, useEffect, useRef } from "react"
import { cleanup } from "@testing-library/react"
import { useQuery } from "./useQuery"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  it("a", async () => {
    const Comp = () => {
      const { data } = useQuery(() => interval(1))

      return <>{data}</>
    }

    const { findByText } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>
    )

    expect(await findByText("3")).toBeDefined()
  })

  it("b", async () => {
    const source = interval(1)

    const Comp = () => {
      const { data } = useQuery(source)

      return <>{data}</>
    }

    const { findByText } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>
    )

    expect(await findByText("3")).toBeDefined()
  })

  describe("Given a new source every render", () => {
    it("", () => {
      expect(true).toBe(true)
    })

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
