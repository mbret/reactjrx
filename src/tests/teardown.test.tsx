import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render } from "@testing-library/react"
import { Subject } from "rxjs"
import { afterAll, expect, it } from "vitest"
import { QueryClientProvider$ } from "../lib/queries/QueryClientProvider$"
import { useQuery$ } from "../lib/queries/useQuery$"

/**
 * Guards the `afterEach` in test-setup.ts. This test ends while TanStack Query
 * still has an update queued for React, and `afterAll` below removes `window`
 * right away, as Vitest sometimes does on CI. If the update is still queued at
 * that point, React throws "window is not defined" and the run fails.
 */
it("lets queued TanStack updates run before jsdom is torn down", async () => {
  const source = new Subject<number>()
  const client = new QueryClient()

  const Comp = () => {
    const { data } = useQuery$({ queryKey: ["teardown"], queryFn: source })

    return <>{data}</>
  }

  const { findByText } = render(
    <QueryClientProvider client={client}>
      <QueryClientProvider$>
        <Comp />
      </QueryClientProvider$>
    </QueryClientProvider>,
  )

  act(() => source.next(1))

  expect(await findByText("1")).toBeDefined()

  // Queues an update for React in TanStack's 0 ms timer, then ends.
  client.setQueryData(["teardown"], 2)
})

afterAll(() => {
  Reflect.deleteProperty(globalThis, "window")
})
