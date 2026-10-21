import { focusManager, MutationObserver } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { BehaviorSubject, concat, defer, NEVER, of, Subject } from "rxjs"
import { describe, expect, it, vi } from "vitest"
import {
  countSubscriptions,
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

  it("holds a value as soon as the stream emits it while a fetch settles", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "settling"]
    const source$ = new Subject<string[]>()
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey,
        queryFn: () => source$,
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    act(() => source$.next(["a"]))

    await waitForData(["a"])

    // The invalidation subscribes again: its fetch settles with the first
    // value, and the next one comes before TanStack stores it.
    act(() => {
      queryClient.invalidateQueries({ queryKey })
      source$.next(["a", "b"])
      source$.next(["a", "b", "c"])
      expect(queryClient.getQueryData(queryKey)).toEqual(["a", "b", "c"])
    })

    // TanStack then stores the refetch's value, which is older.
    await act(() => waitForTimeout(50))

    expect(queryClient.getQueryData(queryKey)).toEqual(["a", "b", "c"])
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

  it("stays fetching while the stream is open and settles when it completes", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "fetching"]
    const { liveQuery$, queryClient } = setup(queryKey)

    await waitForData(["a"])

    act(() => {
      liveQuery$.next(["a", "b"])
    })

    expect(queryClient.getQueryState(queryKey)).toMatchObject({
      fetchStatus: "fetching",
      status: "success",
    })

    act(() => {
      liveQuery$.complete()
    })

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKey)?.fetchStatus).toBe("idle")
    })
    expect(queryClient.getQueryData(queryKey)).toEqual(["a", "b"])
  })

  it("resolves with the last value when the stream completes", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "complete"]
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey,
        queryFn: () =>
          concat(
            of(1, 2),
            defer(() => Promise.resolve(3)),
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKey)?.fetchStatus).toBe("idle")
    })
    expect(queryClient.getQueryData(queryKey)).toBe(3)
  })

  it("keeps a value emitted before TanStack stores the first one", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "before-commit"]
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey,
        queryFn: () =>
          concat(
            of(1),
            defer(() => Promise.resolve(2)),
            NEVER,
          ),
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await waitForData(2)
    await act(() => waitForTimeout(50))

    expect(queryClient.getQueryData(queryKey)).toBe(2)
    expect(queryClient.getQueryState(queryKey)?.fetchStatus).toBe("fetching")
  })

  it("renders once per value", { timeout: 3000 }, async () => {
    const { liveQuery$, queryFn } = createLiveQuerySource(["a"])
    const queryClient = createQueryClient()
    let renders = 0

    function Comp() {
      renders++

      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey: ["live", "renders"],
        queryFn,
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await waitForData(["a"])
    await act(() => waitForTimeout(50))

    // One render while pending, one for the first value.
    expect(renders).toBe(2)

    for (const items of [
      ["a", "b"],
      ["a", "b", "c"],
    ]) {
      await act(async () => {
        liveQuery$.next(items)
        await waitForTimeout(20)
      })
    }

    expect(renders).toBe(4)
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
  /**
   * Renders a live query whose `queryFn` returns `first$`, then `second$`.
   */
  async function renderRestartableLiveQuery(queryKey: string[]) {
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

    return { first$, second$, queryFn, queryClient }
  }

  it("restarts the stream and settles with its first value", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "refetch"]
    const { first$, second$, queryFn, queryClient } =
      await renderRestartableLiveQuery(queryKey)
    const refetched = vi.fn()

    act(() => {
      queryClient.refetchQueries({ queryKey }).then(refetched)
    })
    await act(() => waitForTimeout(20))

    // As for any query, the refetch runs the `queryFn` again, and the data
    // stays until it delivers.
    expect(queryFn).toHaveBeenCalledTimes(2)
    expect(first$.observed).toBe(false)
    expect(refetched).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(queryKey)).toBe("first")

    act(() => second$.next("second"))

    await waitForData("second")

    expect(refetched).toHaveBeenCalledOnce()
    expect(queryClient.getQueryState(queryKey)?.fetchStatus).toBe("fetching")

    act(() => second$.next("third"))

    expect(queryClient.getQueryData(queryKey)).toBe("third")
  })

  it("restarts the stream from an empty query on resetQueries", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "reset"]
    const { first$, second$, queryFn, queryClient } =
      await renderRestartableLiveQuery(queryKey)

    act(() => {
      queryClient.resetQueries({ queryKey })
    })

    expect(queryFn).toHaveBeenCalledTimes(2)
    expect(first$.observed).toBe(false)
    expect(queryClient.getQueryState(queryKey)).toMatchObject({
      data: undefined,
      status: "pending",
      fetchStatus: "fetching",
    })

    act(() => second$.next("second"))

    await waitForData("second")
  })

  it("joins the stream on a refetch before its first value", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "refetch-pending"]
    const source$ = new Subject<string>()
    const queryFn = vi.fn(() => source$)
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({ ...liveQueryOptions, queryKey, queryFn })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    const refetched = vi.fn()

    act(() => {
      queryClient.refetchQueries({ queryKey }).then(refetched)
    })

    // As for any query without data, the refetch joins the fetch in progress.
    expect(queryFn).toHaveBeenCalledOnce()
    expect(source$.observed).toBe(true)

    act(() => source$.next("first"))

    await waitForData("first")

    expect(refetched).toHaveBeenCalledOnce()
  })

  it("settles an awaited invalidation of a live query", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "invalidate"]
    const { liveQuery$, queryClient } = setup(queryKey)

    await waitForData(["a"])

    await act(() => queryClient.invalidateQueries({ queryKey }))

    act(() => liveQuery$.next(["a", "b"]))

    expect(queryClient.getQueryData(queryKey)).toEqual(["a", "b"])
  })

  it("lets a mutation that invalidates a live query settle", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "mutation"]
    const { queryClient } = setup(queryKey)

    await waitForData(["a"])

    const mutation = new MutationObserver(queryClient, {
      mutationFn: async () => "written",
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    })

    await act(() => mutation.mutate())

    expect(mutation.getCurrentResult().status).toBe("success")
  })

  it("does not restart the stream on window focus", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "focus"]
    const { queryFn } = createLiveQuerySource(["a"])
    const spiedQueryFn = vi.fn(queryFn)
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({
        ...liveQueryOptions,
        queryKey,
        queryFn: spiedQueryFn,
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, { wrapper: createWrapper(queryClient) })

    await waitForData(["a"])

    try {
      await act(async () => {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
        await waitForTimeout(10)
      })
    } finally {
      focusManager.setFocused(undefined)
    }

    expect(spiedQueryFn).toHaveBeenCalledOnce()
  })
})

describe("live query cancellation", () => {
  it("stops the stream on cancelQueries", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "cancel"]
    const { liveQuery$, queryClient } = setup(queryKey)

    await waitForData(["a"])

    await act(() => queryClient.cancelQueries({ queryKey }))

    expect(liveQuery$.observed).toBe(false)
    expect(queryClient.getQueryState(queryKey)).toMatchObject({
      data: ["a"],
      fetchStatus: "idle",
      status: "success",
    })

    act(() => liveQuery$.next(["a", "b"]))

    expect(queryClient.getQueryData(queryKey)).toEqual(["a"])
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

  it("puts the query in error when the stream emits undefined after its first value", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "undefined"]
    const source$ = new Subject<string | undefined>()
    const queryClient = createQueryClient()

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

    act(() => source$.next(undefined))

    await waitForData(["error", "a"])
    expect(queryClient.getQueryState(queryKey)?.error?.message).toBe(
      `${JSON.stringify(queryKey)} data is undefined`,
    )
    expect(source$.observed).toBe(false)
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

    liveQuery$.next(["a", "b"])

    act(() => toggle())

    await waitForData(["a", "b"])

    act(() => liveQuery$.next(["a", "b", "c"]))

    expect(queryClient.getQueryData(queryKey)).toEqual(["a", "b", "c"])
  })

  it("leaves it to staleTime whether a remount reopens the stream", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "remount-fresh"]
    const source$ = new BehaviorSubject(["a"])
    const { counted$, subscriptions } = countSubscriptions(source$)
    const queryClient = createQueryClient()
    let toggle = () => {}

    function List() {
      "use no memo"

      const { data } = useQuery$({
        ...liveQueryOptions,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: Number.POSITIVE_INFINITY,
        queryKey,
        queryFn: () => counted$,
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    function Host() {
      "use no memo"

      const [isVisible, setIsVisible] = useState(true)

      toggle = () => setIsVisible((value) => !value)

      return isVisible ? <List /> : null
    }

    render(<Host />, { wrapper: createWrapper(queryClient) })

    await waitForData(["a"])

    act(() => toggle())
    act(() => source$.next(["a", "b"]))
    act(() => toggle())

    await act(() => waitForTimeout(20))

    // As for any query, a value still fresh is shown without fetching again.
    expect(screen.getByTestId("data").textContent).toBe('["a"]')
    expect(subscriptions).toEqual({ made: 1, open: 0 })
  })

  it("keeps the stream open under StrictMode", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "strict"]
    const { liveQuery$, queryFn } = createLiveQuerySource(["a"])
    const queryClient = createQueryClient()

    function Comp() {
      const { data } = useQuery$({ ...liveQueryOptions, queryKey, queryFn })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Comp />, {
      wrapper: createWrapper(queryClient),
      reactStrictMode: true,
    })

    await waitForData(["a"])

    act(() => liveQuery$.next(["a", "b"]))

    expect(queryClient.getQueryData(queryKey)).toEqual(["a", "b"])
  })

  it("takes the current value without keeping a stream for an unobserved query", {
    timeout: 3000,
  }, async () => {
    const queryKey = ["live", "unobserved"]
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

    liveQuery$.next(["a", "b"])

    await act(() => queryClient.refetchQueries({ queryKey }))

    expect(queryClient.getQueryState(queryKey)).toMatchObject({
      data: ["a", "b"],
      fetchStatus: "idle",
    })
    expect(liveQuery$.observed).toBe(false)
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
