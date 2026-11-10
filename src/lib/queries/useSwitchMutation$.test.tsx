import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { fireEvent } from "@testing-library/dom"
import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import { act, useState } from "react"
import {
  delay,
  EMPTY,
  finalize,
  map,
  NEVER,
  type Observable,
  of,
  throwError,
  timer,
} from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest"
import { createWrapper } from "../../tests/liveQuery"
import { waitForTimeout } from "../../tests/utils"
import {
  SwitchMutationCancelError,
  useSwitchMutation$,
} from "./useSwitchMutation$"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("useSwitchMutation$", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient()
  })

  it("should run mutation normally", async () => {
    const onSuccess = vi.fn()
    const finalizeSpy = vi.fn()

    const TestComponent = () => {
      "use no memo"

      const [result, setResult] = useState<string | null>(null)
      const { mutate } = useSwitchMutation$<string, Error, string>({
        mutationFn: (variables: string) =>
          of(`result: ${variables}`).pipe(delay(10), finalize(finalizeSpy)),
        onSuccess: (data) => {
          onSuccess(data)
          setResult(data)
        },
      })

      return (
        <div>
          <button type="button" onClick={() => mutate("test")}>
            Trigger Mutation
          </button>
          <div data-testid="result">{result}</div>
        </div>
      )
    }

    render(
      <QueryClientProvider client={queryClient}>
        <TestComponent />
      </QueryClientProvider>,
    )

    // Trigger the mutation
    act(() => {
      fireEvent.click(screen.getByText("Trigger Mutation"))
    })

    // Wait for the result
    await waitFor(() => {
      expect(screen.getByTestId("result").textContent).toBe("result: test")
    })

    expect(onSuccess).toHaveBeenCalledWith("result: test")
    expect(finalizeSpy).toHaveBeenCalledTimes(1)
  })

  it("should cancel the first mutation when a second one is triggered", async () => {
    const cancelSpy1 = vi.fn()
    const cancelSpy2 = vi.fn()
    const successSpy = vi.fn()

    const TestComponent = () => {
      "use no memo"

      const [result, setResult] = useState<string | null>(null)
      const { mutate } = useSwitchMutation$<string, Error, string>({
        mutationFn: (variables: string) =>
          of(`result: ${variables}`).pipe(
            delay(50),
            finalize(() => {
              cancelSpy2()
            }),
          ),
        onSuccess: (data) => {
          successSpy(data)
          setResult(data)
        },
        onError: (error, variables) => {
          if (
            variables === "first" &&
            error instanceof SwitchMutationCancelError
          ) {
            cancelSpy1()
            return
          }
        },
      })

      return (
        <div>
          <button
            type="button"
            data-testid="btn-first"
            onClick={() => mutate("first")}
          >
            First Mutation
          </button>
          <button
            type="button"
            data-testid="btn-second"
            onClick={() => mutate("second")}
          >
            Second Mutation
          </button>
          <div data-testid="result">{result}</div>
        </div>
      )
    }

    render(
      <QueryClientProvider client={queryClient}>
        <TestComponent />
      </QueryClientProvider>,
    )

    // Trigger the first mutation
    act(() => {
      fireEvent.click(screen.getByTestId("btn-first"))
    })

    // Immediately trigger the second mutation (before the first one completes)
    act(() => {
      fireEvent.click(screen.getByTestId("btn-second"))
    })

    // Wait for the result - only the second mutation should complete
    await waitFor(() => {
      expect(screen.getByTestId("result").textContent).toBe("result: second")
    })

    // The first mutation should have been canceled
    expect(cancelSpy1).toHaveBeenCalledTimes(1)
    expect(cancelSpy2).toHaveBeenCalledTimes(1)

    // Only the second mutation should have triggered onSuccess
    expect(successSpy).toHaveBeenCalledTimes(1)
    expect(successSpy).toHaveBeenCalledWith("result: second")
  })

  it("should cancel long-running mutations when a new one is triggered", async () => {
    // Subject to control when the first mutation completes
    const onCompleteSpy1 = vi.fn()
    const onCompleteSpy2 = vi.fn()
    const onCompleteSpy3 = vi.fn()

    const successSpy = vi.fn()

    // Component with a long-running mutation
    const TestComponent = () => {
      "use no memo"

      const [state, setState] = useState<string | null>(null)
      const { mutate } = useSwitchMutation$<string, Error, string>({
        mutationFn: (id: string) => {
          // Choose which observable to return based on the id
          if (id === "first") {
            return timer(1000).pipe(
              map((val) => `timer value: ${val}`), // Convert number to string
              finalize(() => onCompleteSpy1()),
            )
          }

          if (id === "second") {
            return timer(1000).pipe(
              map((val) => `timer value: ${val}`), // Convert number to string
              finalize(() => onCompleteSpy2()),
            )
          }

          return of(`completed: ${id}`).pipe(
            delay(10),
            finalize(() => onCompleteSpy3()),
          )
        },
        onSuccess: (data) => {
          successSpy(data)

          if (data) setState(data)
        },
      })

      return (
        <div>
          <button
            type="button"
            data-testid="run-first"
            onClick={() => mutate("first")}
          >
            Run First
          </button>
          <button
            type="button"
            data-testid="run-second"
            onClick={() => mutate("second")}
          >
            Run Second
          </button>
          <button
            type="button"
            data-testid="run-third"
            onClick={() => mutate("third")}
          >
            Run Third
          </button>
          <div data-testid="state">{state}</div>
        </div>
      )
    }

    render(
      <QueryClientProvider client={queryClient}>
        <TestComponent />
      </QueryClientProvider>,
    )

    // Start the first long-running mutation
    act(() => {
      fireEvent.click(screen.getByTestId("run-first"))
    })

    // Wait a moment to ensure the first mutation is running
    await act(async () => {
      await waitForTimeout(50)
    })

    // Start the second long-running mutation - this should cancel the first
    act(() => {
      fireEvent.click(screen.getByTestId("run-second"))
    })

    // Verify the first mutation was finalized (canceled)
    expect(onCompleteSpy1).toHaveBeenCalledTimes(1)

    // Wait a moment to ensure the second mutation is running
    await act(async () => {
      await waitForTimeout(50)
    })

    // Start the third mutation (which completes quickly)
    act(() => {
      fireEvent.click(screen.getByTestId("run-third"))
    })

    // Verify the second mutation was finalized (canceled)
    expect(onCompleteSpy2).toHaveBeenCalledTimes(1)

    // Wait for the third mutation to complete
    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("completed: third")
    })

    // Verify the third mutation completed
    expect(onCompleteSpy3).toHaveBeenCalledTimes(1)
    expect(successSpy).toHaveBeenCalledWith("completed: third")

    // The long-running mutations should not have called onSuccess with data
    expect(successSpy).toHaveBeenCalledTimes(1)
  })

  it("should resolve with null when the mutation stream completes without emitting", async () => {
    const onSuccess = vi.fn()
    let mutateAsyncResult: Promise<string | null> | undefined

    const TestComponent = () => {
      "use no memo"

      const { mutateAsync } = useSwitchMutation$<string, Error, string>({
        mutationFn: () => EMPTY,
        onSuccess,
      })

      return (
        <button
          type="button"
          onClick={() => {
            mutateAsyncResult = mutateAsync("test")
          }}
        >
          Trigger Mutation
        </button>
      )
    }

    render(
      <QueryClientProvider client={queryClient}>
        <TestComponent />
      </QueryClientProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByText("Trigger Mutation"))
    })

    const pendingSentinel = Symbol("pending")

    // the promise must settle on its own (with null), not hang until
    // a subsequent mutation aborts it
    await waitFor(async () => {
      expect(
        await Promise.race([
          mutateAsyncResult,
          Promise.resolve(pendingSentinel),
        ]),
      ).toBe(null)
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess.mock.calls[0]?.[0]).toBe(null)
    expect(onSuccess.mock.calls[0]?.[1]).toBe("test")
  })

  describe("Given defaults on the QueryClient", () => {
    it("should run the default callbacks with the variables given to mutate", async () => {
      const onMutate = vi.fn()
      const onSuccess = vi.fn()
      const onSettled = vi.fn()
      const client = new QueryClient({
        defaultOptions: { mutations: { onMutate, onSuccess, onSettled } },
      })
      const { result } = renderHook(
        () => useSwitchMutation$({ mutationFn: (value: number) => of(value) }),
        { wrapper: createWrapper(client) },
      )

      await act(() => result.current.mutateAsync(1))

      expect(onMutate.mock.calls[0]?.[0]).toBe(1)
      expect(onSuccess.mock.calls[0]?.slice(0, 2)).toEqual([1, 1])
      expect(onSettled.mock.calls[0]?.slice(0, 3)).toEqual([1, null, 1])
    })

    it("should run the onError set for its mutation key", async () => {
      const onError = vi.fn()
      const client = new QueryClient()
      client.setMutationDefaults(["save"], { onError })
      const failure = new Error("failed")
      const { result } = renderHook(
        () =>
          useSwitchMutation$({
            mutationKey: ["save"],
            mutationFn: (_value: number) => throwError(() => failure),
          }),
        { wrapper: createWrapper(client) },
      )

      await act(() => result.current.mutateAsync(1).catch(() => undefined))

      expect(onError.mock.calls[0]?.slice(0, 2)).toEqual([failure, 1])
    })

    it("should run its own callback instead of the default one", async () => {
      const defaultOnSuccess = vi.fn()
      const onSuccess = vi.fn()
      const client = new QueryClient({
        defaultOptions: { mutations: { onSuccess: defaultOnSuccess } },
      })
      const { result } = renderHook(
        () =>
          useSwitchMutation$({
            mutationFn: (value: number) => of(value),
            onSuccess,
          }),
        { wrapper: createWrapper(client) },
      )

      await act(() => result.current.mutateAsync(1))

      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(defaultOnSuccess).not.toHaveBeenCalled()
    })
  })

  describe("result.variables", () => {
    it("should be the variables given to mutate", async () => {
      const { result } = renderHook(
        () => useSwitchMutation$({ mutationFn: (value: number) => of(value) }),
        { wrapper: createWrapper(new QueryClient()) },
      )

      await act(() => result.current.mutateAsync(7))
      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expectTypeOf(result.current.variables).toEqualTypeOf<number | undefined>()
      expect(result.current.variables).toBe(7)

      if (result.current.isSuccess) {
        expectTypeOf(result.current.variables).toEqualTypeOf<number>()
      }
    })
  })

  describe("retry", () => {
    it("should fail a cancelled call at once, without retrying it", async () => {
      const client = new QueryClient()
      const { result } = renderHook(
        () =>
          useSwitchMutation$({
            retry: 2,
            retryDelay: 10_000,
            mutationFn: (value: string) =>
              value === "first" ? NEVER : of(value),
          }),
        { wrapper: createWrapper(client) },
      )

      act(() => result.current.mutate("first"))
      await act(() => result.current.mutateAsync("second"))

      const [cancelled] = client.getMutationCache().getAll()

      await waitFor(() => expect(cancelled?.state.status).toBe("error"), {
        timeout: 200,
      })
      expect(cancelled?.state.error).toBeInstanceOf(SwitchMutationCancelError)
      expect(cancelled?.state.failureCount).toBe(1)
    })

    describe("Given a call that fails", () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
        onlineManager.setOnline(true)
        focusManager.setFocused(undefined)
      })

      it("should fail at once when it is cancelled while it waits retryDelay, without another attempt", async () => {
        const client = new QueryClient()
        const mutationFn = vi.fn((value: string) =>
          value === "first" ? throwError(() => new Error("failed")) : of(value),
        )
        const { result } = renderHook(
          () =>
            useSwitchMutation$({
              scope: { id: "save" },
              retry: 3,
              retryDelay: 10_000,
              mutationFn,
            }),
          { wrapper: createWrapper(client) },
        )

        act(() => result.current.mutate("first"))
        await act(() => vi.advanceTimersByTimeAsync(1))
        act(() => result.current.mutate("second"))
        await act(() => vi.advanceTimersByTimeAsync(1))

        const [cancelled, next] = client.getMutationCache().getAll()

        expect(cancelled?.state.error).toBeInstanceOf(SwitchMutationCancelError)
        expect(next?.state.status).toBe("success")
        expect(mutationFn.mock.calls.map(([value]) => value)).toEqual([
          "first",
          "second",
        ])
      })

      it.each([
        {
          change: "the device goes offline",
          leave: () => onlineManager.setOnline(false),
          comeBack: () => onlineManager.setOnline(true),
        },
        {
          change: "the page is hidden",
          leave: () => focusManager.setFocused(false),
          comeBack: () => focusManager.setFocused(true),
        },
      ])(
        "should hold the retry when $change during the wait, until it comes back",
        async ({ leave, comeBack }) => {
          const client = new QueryClient()
          const mutationFn = vi.fn((_value: number) =>
            mutationFn.mock.calls.length === 1
              ? throwError(() => new Error("failed"))
              : of("saved"),
          )
          const { result } = renderHook(
            () =>
              useSwitchMutation$({ retry: 1, retryDelay: 1000, mutationFn }),
            { wrapper: createWrapper(client) },
          )

          act(() => result.current.mutate(1))
          await act(() => vi.advanceTimersByTimeAsync(10))
          act(leave)
          await act(() => vi.advanceTimersByTimeAsync(2000))

          expect(mutationFn).toHaveBeenCalledTimes(1)
          expect(result.current.isPaused).toBe(true)

          act(comeBack)
          await act(() => vi.advanceTimersByTimeAsync(0))

          expect(mutationFn).toHaveBeenCalledTimes(2)
          expect(result.current.data).toBe("saved")
        },
      )

      it("should fail once it resumes when it is cancelled while TanStack Query holds its retry", async () => {
        const client = new QueryClient()
        const mutationFn = vi.fn((value: string) =>
          value === "first" ? throwError(() => new Error("failed")) : of(value),
        )
        const { result } = renderHook(
          () => useSwitchMutation$({ retry: 1, retryDelay: 100, mutationFn }),
          { wrapper: createWrapper(client) },
        )

        act(() => result.current.mutate("first"))
        await act(() => vi.advanceTimersByTimeAsync(10))
        act(() => onlineManager.setOnline(false))
        await act(() => vi.advanceTimersByTimeAsync(200))
        act(() => result.current.mutate("second"))
        await act(() => vi.advanceTimersByTimeAsync(200))

        const [cancelled] = client.getMutationCache().getAll()

        expect(cancelled?.state.status).toBe("pending")
        expect(cancelled?.state.isPaused).toBe(true)

        act(() => onlineManager.setOnline(true))
        await act(() => vi.advanceTimersByTimeAsync(0))

        expect(cancelled?.state.error).toBeInstanceOf(SwitchMutationCancelError)
        expect(mutationFn.mock.calls.map(([value]) => value)).toEqual([
          "first",
          "second",
        ])
      })

      it.each([
        {
          source: "its retryDelay",
          options: { retryDelay: 300 },
          defaults: {},
          delay: 300,
        },
        {
          source: "the client's default retryDelay",
          options: {},
          defaults: { retryDelay: 300 },
          delay: 300,
        },
        {
          source: "TanStack Query's default delay",
          options: {},
          defaults: {},
          delay: 1000,
        },
      ])(
        "should wait $source before it retries",
        async ({ options, defaults, delay }) => {
          const mutationFn = vi.fn((_value: number) =>
            throwError(() => new Error("failed")),
          )
          const client = new QueryClient({
            defaultOptions: { mutations: { retry: 1, ...defaults } },
          })
          const { result } = renderHook(
            () => useSwitchMutation$({ ...options, mutationFn }),
            { wrapper: createWrapper(client) },
          )

          act(() => result.current.mutate(1))
          await act(() => vi.advanceTimersByTimeAsync(delay - 1))

          expect(mutationFn).toHaveBeenCalledTimes(1)

          await act(() => vi.advanceTimersByTimeAsync(10))

          expect(mutationFn).toHaveBeenCalledTimes(2)
        },
      )

      it("should wait retryDelay when mutationFn throws", async () => {
        const mutationFn = vi.fn((_value: number): Observable<string> => {
          throw new Error("invalid")
        })
        const { result } = renderHook(
          () => useSwitchMutation$({ retry: 1, retryDelay: 1000, mutationFn }),
          { wrapper: createWrapper(new QueryClient()) },
        )

        act(() => result.current.mutate(1))
        await act(() => vi.advanceTimersByTimeAsync(999))

        expect(mutationFn).toHaveBeenCalledTimes(1)

        await act(() => vi.advanceTimersByTimeAsync(10))

        expect(mutationFn).toHaveBeenCalledTimes(2)
      })

      it("should follow a retry option changed while it waits", async () => {
        const mutationFn = vi.fn((_value: number) =>
          throwError(() => new Error("failed")),
        )
        const { result, rerender } = renderHook(
          ({ retry }: { retry: boolean }) =>
            useSwitchMutation$({ retry, retryDelay: 1000, mutationFn }),
          {
            wrapper: createWrapper(new QueryClient()),
            initialProps: { retry: true },
          },
        )

        act(() => result.current.mutate(1))
        await act(() => vi.advanceTimersByTimeAsync(10))
        rerender({ retry: false })
        await act(() => vi.advanceTimersByTimeAsync(2000))

        expect(mutationFn).toHaveBeenCalledTimes(1)
        expect(result.current.status).toBe("error")
      })

      it("should fail at once when its source fails with SwitchMutationCancelError", async () => {
        const mutationFn = vi.fn((_value: number) =>
          throwError(() => new SwitchMutationCancelError()),
        )
        const { result } = renderHook(
          () =>
            useSwitchMutation$({ retry: 3, retryDelay: 10_000, mutationFn }),
          { wrapper: createWrapper(new QueryClient()) },
        )

        act(() => result.current.mutate(1))
        await act(() => vi.advanceTimersByTimeAsync(1))

        expect(result.current.status).toBe("error")
        expect(mutationFn).toHaveBeenCalledTimes(1)
      })

      it("should give retryDelay the failure count and the error of the failure it retries", async () => {
        const errors = [new Error("first"), new Error("second")]
        const mutationFn = vi.fn((_value: number) =>
          throwError(() => errors[mutationFn.mock.calls.length - 1]),
        )
        const retryDelay = vi.fn((_failureCount: number, _error: Error) => 100)
        const { result } = renderHook(
          () => useSwitchMutation$({ retry: 2, retryDelay, mutationFn }),
          { wrapper: createWrapper(new QueryClient()) },
        )

        act(() => result.current.mutate(1))
        await act(() => vi.advanceTimersByTimeAsync(1000))

        expect(mutationFn).toHaveBeenCalledTimes(3)
        expect(retryDelay.mock.calls).toEqual([
          [0, errors[0]],
          [1, errors[1]],
        ])
      })
    })

    it("should retry another error as its retry option says", async () => {
      const mutationFn = vi.fn((_value: number) =>
        throwError(() => new Error("failed")),
      )
      const { result } = renderHook(
        () => useSwitchMutation$({ retry: 1, retryDelay: 0, mutationFn }),
        { wrapper: createWrapper(new QueryClient()) },
      )

      await act(() => result.current.mutateAsync(1).catch(() => undefined))

      expect(mutationFn).toHaveBeenCalledTimes(2)
    })

    it("should retry another error as the default retry says", async () => {
      const mutationFn = vi.fn((_value: number) =>
        throwError(() => new Error("failed")),
      )
      const client = new QueryClient({
        defaultOptions: { mutations: { retry: 1, retryDelay: 0 } },
      })
      const { result } = renderHook(() => useSwitchMutation$({ mutationFn }), {
        wrapper: createWrapper(client),
      })

      await act(() => result.current.mutateAsync(1).catch(() => undefined))

      expect(mutationFn).toHaveBeenCalledTimes(2)
    })
  })
})
