import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent } from "@testing-library/dom"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { act, useState } from "react"
import { delay, EMPTY, finalize, map, of, timer } from "rxjs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { waitForTimeout } from "../../tests/utils"
import { QueryClientProvider$ } from "./QueryClientProvider$"
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
        <QueryClientProvider$>
          <TestComponent />
        </QueryClientProvider$>
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
        <QueryClientProvider$>
          <TestComponent />
        </QueryClientProvider$>
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
        <QueryClientProvider$>
          <TestComponent />
        </QueryClientProvider$>
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
        <QueryClientProvider$>
          <TestComponent />
        </QueryClientProvider$>
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
})
