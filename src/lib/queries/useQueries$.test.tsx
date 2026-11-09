import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { of } from "rxjs"
import { afterEach, describe, expect, expectTypeOf, it } from "vitest"
import { createWrapper } from "../../tests/liveQuery"
import { useQueries$ } from "./useQueries$"

afterEach(() => {
  cleanup()
})

const wrap = (ui: React.ReactNode) => {
  const client = new QueryClient()

  return render(
    <React.StrictMode>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
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

describe("Given a query without a queryFn", () => {
  it("should run the default queryFn of the QueryClient", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    client.setQueryDefaults(["todos"], { queryFn: async () => "todos" })
    const { result } = renderHook(
      () => useQueries$({ queries: [{ queryKey: ["todos"] }] }),
      { wrapper: createWrapper(client) },
    )

    await waitFor(() => expect(result.current[0]?.status).not.toBe("pending"))

    expect(result.current[0]?.data).toBe("todos")
  })
})
