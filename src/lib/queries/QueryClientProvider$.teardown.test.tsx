import {
  QueryClient,
  QueryClientProvider,
  type QueryKey,
} from "@tanstack/react-query"
import { act, render, waitFor } from "@testing-library/react"
import { useState } from "react"
import { BehaviorSubject } from "rxjs"
import { describe, expect, it } from "vitest"
import { waitForTimeout } from "../../tests/utils"
import { QueryClient$, QueryClientProvider$ } from "./QueryClientProvider$"
import { useQuery$ } from "./useQuery$"

/**
 * Renders one consumer of a live query (a stream that never completes) and
 * returns a way to unmount it while the providers stay mounted.
 */
const renderLiveQuery = ({
  queryKeyHashFn,
}: {
  queryKeyHashFn?: (queryKey: QueryKey) => string
} = {}) => {
  const source = new BehaviorSubject(1)
  const queryClient = new QueryClient()
  const queryClient$ = new QueryClient$(queryClient)
  let hide = () => {}

  const Consumer = () => {
    "use no memo"

    const { data } = useQuery$({
      queryKey: ["live"],
      queryFn: source,
      staleTime: Number.POSITIVE_INFINITY,
      queryKeyHashFn,
    })

    return <>{data}</>
  }

  const Host = () => {
    "use no memo"

    const [isVisible, setIsVisible] = useState(true)

    hide = () => setIsVisible(false)

    return isVisible ? <Consumer /> : null
  }

  const { findByText } = render(
    <QueryClientProvider client={queryClient}>
      <QueryClientProvider$ client={queryClient$}>
        <Host />
      </QueryClientProvider$>
    </QueryClientProvider>,
  )

  return {
    source,
    queryClient$,
    findByText,
    hide: () => act(() => hide()),
  }
}

describe("Given a live query whose last observer unmounts", () => {
  it("should stop the stream once it has refetched", {
    timeout: 3000,
  }, async () => {
    const { source, queryClient$, findByText, hide } = renderLiveQuery()

    expect(await findByText("1")).toBeDefined()

    // Let the refetch loop start waiting for the next value.
    await waitForTimeout(50)

    expect(source.observed).toBe(true)

    hide()

    await waitFor(() => {
      expect(source.observed).toBe(false)
    })

    expect(queryClient$.queryMap.size).toBe(0)
  })

  it("should stop the stream when the query uses a custom queryKeyHashFn", {
    timeout: 3000,
  }, async () => {
    const { source, queryClient$, findByText, hide } = renderLiveQuery({
      queryKeyHashFn: (queryKey) => `custom:${JSON.stringify(queryKey)}`,
    })

    expect(await findByText("1")).toBeDefined()

    await waitForTimeout(50)

    expect(source.observed).toBe(true)

    hide()

    await waitFor(() => {
      expect(queryClient$.queryMap.size).toBe(0)
    })

    await waitFor(() => {
      expect(source.observed).toBe(false)
    })
  })
})
