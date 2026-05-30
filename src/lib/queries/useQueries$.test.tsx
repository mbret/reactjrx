import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render } from "@testing-library/react"
import React from "react"
import { of } from "rxjs"
import { afterEach, describe, expect, expectTypeOf, it } from "vitest"
import { QueryClientProvider$ } from "./QueryClientProvider$"
import { useQueries$ } from "./useQueries$"

afterEach(() => {
  cleanup()
})

const wrap = (ui: React.ReactNode) => {
  const client = new QueryClient()

  return render(
    <React.StrictMode>
      <QueryClientProvider client={client}>
        <QueryClientProvider$>{ui}</QueryClientProvider$>
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

describe("Given several queries returning synchronous observable values", () => {
  it("should resolve every query result", async () => {
    const Comp = () => {
      const [a, b] = useQueries$({
        queries: [
          { queryKey: ["a"], queryFn: () => of(1) },
          { queryKey: ["b"], queryFn: () => of("two") },
        ],
      })

      expectTypeOf(a.data).toEqualTypeOf<number | undefined>()
      expectTypeOf(b.data).toEqualTypeOf<string | undefined>()

      return <>{JSON.stringify([a.data, b.data])}</>
    }

    const { findByText } = wrap(<Comp />)

    expect(await findByText(JSON.stringify([1, "two"]))).toBeDefined()
  })
})

describe("Given a combine function", () => {
  it("should expose the combined result", async () => {
    const Comp = () => {
      const total = useQueries$({
        queries: [
          { queryKey: ["a"], queryFn: () => of(1) },
          { queryKey: ["b"], queryFn: () => of(2) },
        ],
        combine: (results) =>
          results.reduce((acc, { data }) => acc + (data ?? 0), 0),
      })

      expectTypeOf(total).toEqualTypeOf<number>()

      return <>{total}</>
    }

    const { findByText } = wrap(<Comp />)

    expect(await findByText("3")).toBeDefined()
  })
})
