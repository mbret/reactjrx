import { dehydrate, QueryClient } from "@tanstack/react-query"
import {
  type PersistedClient,
  PersistQueryClientProvider,
} from "@tanstack/react-query-persist-client"
import { act, render, screen, waitFor } from "@testing-library/react"
import { BehaviorSubject } from "rxjs"
import { describe, expect, it } from "vitest"
import { countSubscriptions } from "../../tests/liveQuery"
import { waitForTimeout } from "../../tests/utils"
import { useQuery$ } from "./useQuery$"

const queryKey = ["live", "persisted"]

const waitForData = (data: unknown) =>
  waitFor(() => {
    expect(screen.getByTestId("data").textContent).toBe(JSON.stringify(data))
  })

/**
 * An in-memory persister, optionally holding a cache persisted earlier.
 */
function createMemoryPersister(initial?: PersistedClient) {
  let stored = initial

  return {
    persister: {
      persistClient: async (client: PersistedClient) => {
        stored = client
      },
      restoreClient: async () => stored,
      removeClient: async () => {
        stored = undefined
      },
    },
    readPersistedData: () =>
      stored?.clientState.queries.find(
        (query) => JSON.stringify(query.queryKey) === JSON.stringify(queryKey),
      )?.state.data,
  }
}

function persistedClientWithData(data: unknown): PersistedClient {
  const queryClient = new QueryClient()

  queryClient.setQueryData(queryKey, data)

  return {
    timestamp: Date.now(),
    buster: "",
    clientState: dehydrate(queryClient),
  }
}

function renderPersistedLiveQuery(stored?: PersistedClient) {
  const source$ = new BehaviorSubject(["a"])
  const { counted$, subscriptions } = countSubscriptions(source$)
  const { persister, readPersistedData } = createMemoryPersister(stored)
  const queryClient = new QueryClient()

  function Comp() {
    "use no memo"

    const { data } = useQuery$({ queryKey, queryFn: () => counted$ })

    return <span data-testid="data">{JSON.stringify(data)}</span>
  }

  render(
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      <Comp />
    </PersistQueryClientProvider>,
  )

  return { source$, subscriptions, readPersistedData }
}

describe("live query with a persisted cache", () => {
  it("persists the latest value of the stream", {
    timeout: 3000,
  }, async () => {
    const live = renderPersistedLiveQuery()

    await waitForData(["a"])

    act(() => live.source$.next(["a", "b"]))

    await waitFor(() => {
      expect(live.readPersistedData()).toEqual(["a", "b"])
    })
  })

  it("shows the restored value, then follows the stream", {
    timeout: 3000,
  }, async () => {
    const live = renderPersistedLiveQuery(persistedClientWithData(["old"]))

    await waitForData(["a"])

    act(() => live.source$.next(["a", "b"]))

    await waitForData(["a", "b"])
    await act(() => waitForTimeout(20))

    expect(live.subscriptions).toEqual({ made: 1, open: 1 })
  })
})
