import { act, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { concat, defer, of, Subject } from "rxjs"
import { describe, expect, it, vi } from "vitest"
import {
  createLiveQuerySource,
  createQueryClient,
  createWrapper,
  liveQueryOptions,
} from "../../tests/liveQuery"
import { waitForTimeout } from "../../tests/utils"
import { useQueries$ } from "./useQueries$"
import { useQuery$ } from "./useQuery$"

function setup(queryKey: string[]) {
  const { liveQuery$, queryFn } = createLiveQuerySource(["a"])
  const queryClient = createQueryClient()

  function Comp() {
    const { data } = useQuery$({ ...liveQueryOptions, queryKey, queryFn })

    return <span data-testid="data">{JSON.stringify(data)}</span>
  }

  render(<Comp />, { wrapper: createWrapper(queryClient) })

  return { liveQuery$, queryClient }
}

const waitForData = (data: unknown) =>
  waitFor(() => {
    expect(screen.getByTestId("data").textContent).toBe(JSON.stringify(data))
  })

describe("live query cache", () => {
  it("holds a value as soon as the stream emits it", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "sync"]
    const { liveQuery$, queryClient } = setup(queryKey)

    await waitForData(["a"])

    act(() => {
      liveQuery$.next(["a", "b"])
    })

    expect(queryClient.getQueryData(queryKey)).toEqual(["a", "b"])
  })

  it("keeps a value emitted right after the previous one reached the cache", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "gap"]
    const { liveQuery$, queryClient } = setup(queryKey)

    await waitForData(["a"])

    const emitThirdValue = vi.fn(() => liveQuery$.next(["a", "b", "c"]))
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const isSecondValueCached =
        event.type === "updated" &&
        event.action.type === "success" &&
        JSON.stringify(event.query.state.data) === '["a","b"]'

      if (!isSecondValueCached) return

      unsubscribe()
      emitThirdValue()
    })

    act(() => {
      liveQuery$.next(["a", "b"])
    })

    await act(() => waitForTimeout(1000))

    expect(emitThirdValue).toHaveBeenCalledOnce()
    expect(screen.getByTestId("data").textContent).toBe('["a","b","c"]')
  })

  it("does not start a fetch for later values", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "idle"]
    const { liveQuery$, queryClient } = setup(queryKey)

    await waitForData(["a"])

    act(() => {
      liveQuery$.next(["a", "b"])
    })

    expect(queryClient.getQueryState(queryKey)).toMatchObject({
      fetchStatus: "idle",
      status: "success",
    })
  })

  it("keeps the values emitted before the first one reached the cache", {
    timeout: 3000,
  }, async () => {
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey: ["live", "before-commit"],
        queryFn: () =>
          concat(
            of(1, 2),
            defer(() => Promise.resolve(3)),
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await waitForData(3)

    await act(() => waitForTimeout(50))

    expect(queryClient.getQueryData(["live", "before-commit"])).toBe(3)
  })

  it("holds a value as soon as the stream emits it with useQueries$", {
    timeout: 3000,
  }, async () => {
    const { liveQuery$, queryFn } = createLiveQuerySource(["a"])
    const queryClient = createQueryClient()

    function Comp() {
      const [{ data }] = useQueries$({
        queries: [
          { ...liveQueryOptions, queryKey: ["live", "queries"], queryFn },
        ],
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await waitForData(["a"])

    act(() => {
      liveQuery$.next(["a", "b"])
    })

    expect(queryClient.getQueryData(["live", "queries"])).toEqual(["a", "b"])
  })
})

describe("live query refetch", () => {
  it("runs the queryFn again and replaces the running stream", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "refetch"]
    const first$ = new Subject<string>()
    const second$ = new Subject<string>()
    const queryFn = vi
      .fn()
      .mockReturnValueOnce(first$)
      .mockReturnValueOnce(second$)
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({ ...liveQueryOptions, queryKey, queryFn })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    act(() => first$.next("first"))

    await waitForData("first")

    await act(async () => {
      queryClient.refetchQueries({ queryKey })
    })

    expect(queryFn).toHaveBeenCalledTimes(2)
    expect(first$.observed).toBe(false)
    expect(queryClient.getQueryState(queryKey)?.fetchStatus).toBe("fetching")

    act(() => second$.next("second"))

    await waitForData("second")
    expect(queryClient.getQueryState(queryKey)?.fetchStatus).toBe("idle")
  })
})

describe("live query error", () => {
  it("puts the query in error when the stream errors after its first value", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "error"]
    const source$ = new Subject<string>()
    const queryClient = createQueryClient()
    const error = new Error("stream failed")

    function Comp() {
      const { data, status } = useQuery$({
        ...liveQueryOptions,
        retry: false,
        queryKey,
        queryFn: () => source$,
      })

      return <span data-testid="data">{JSON.stringify([status, data])}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    act(() => source$.next("a"))

    await waitForData(["success", "a"])

    act(() => source$.error(error))

    await waitForData(["error", "a"])
    expect(queryClient.getQueryState(queryKey)?.error).toBe(error)
  })
})

describe("live query lifecycle", () => {
  it("refetches on remount after the stream stopped with its last observer", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "remount"]
    const { liveQuery$, queryFn } = createLiveQuerySource(["a"])
    const queryClient = createQueryClient()
    let toggle = () => {}

    function List() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        gcTime: Number.POSITIVE_INFINITY,
        queryKey,
        queryFn,
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    function Host() {
      const [isVisible, setIsVisible] = useState(true)

      toggle = () => setIsVisible((value) => !value)

      return isVisible ? <List /> : null
    }

    render(<Host />, { wrapper: createWrapper(queryClient) })

    await waitForData(["a"])

    act(() => toggle())

    expect(liveQuery$.observed).toBe(false)
    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true)

    liveQuery$.next(["a", "b"])

    act(() => toggle())

    await waitForData(["a", "b"])

    act(() => liveQuery$.next(["a", "b", "c"]))

    expect(queryClient.getQueryData(queryKey)).toEqual(["a", "b", "c"])
  })

  it("stops the stream when the query is removed from the cache", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "clear"]
    const { liveQuery$, queryClient } = setup(queryKey)

    await waitForData(["a"])

    act(() => {
      queryClient.clear()
    })

    expect(liveQuery$.observed).toBe(false)

    act(() => liveQuery$.next(["a", "b"]))

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})
