import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react"
import {
  type FC,
  type PropsWithChildren,
  Component as ReactComponent,
  type ReactNode,
  StrictMode,
  useEffect,
  useState,
} from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { isShallowEqual } from "../../utils/shallowEqual"
import { SIGNAL_RESET } from "../constants"
import { signal, virtualSignal } from "../Signal"
import {
  SignalContextProvider,
  useMakeOrRetrieveSignal,
} from "./SignalContextProvider"
import { useSignalValue } from "./useSignalValue"

afterEach(() => {
  cleanup()
})

describe("useSignalValue", () => {
  describe("Without selector", () => {
    it("should return the current value of the signal on first render", () => {
      const state = signal({ default: 5 })

      const { result } = renderHook(() => useSignalValue(state))

      expect(result.current).toBe(5)
    })

    it("should return undefined when signal has no default", () => {
      const state = signal<number | undefined>({})

      const { result } = renderHook(() => useSignalValue(state))

      expect(result.current).toBeUndefined()
    })

    it("should re-render when signal value changes", () => {
      const state = signal({ default: 0 })

      const { result } = renderHook(() => useSignalValue(state))

      expect(result.current).toBe(0)

      act(() => {
        state.update(1)
      })

      expect(result.current).toBe(1)

      act(() => {
        state.update(2)
      })

      expect(result.current).toBe(2)
    })

    it("should reset to default value", () => {
      const state = signal({ default: 5 })

      const { result } = renderHook(() => useSignalValue(state))

      act(() => {
        state.update(10)
      })

      expect(result.current).toBe(10)

      act(() => {
        state.update(SIGNAL_RESET)
      })

      expect(result.current).toBe(5)
    })

    it("should not re-render when the same primitive value is emitted", () => {
      const state = signal({ default: 5 })
      const renders = vi.fn()

      renderHook(() => {
        renders()

        return useSignalValue(state)
      })

      expect(renders).toHaveBeenCalledTimes(1)

      act(() => {
        state.update(5)
      })

      expect(renders).toHaveBeenCalledTimes(1)
    })

    it("should re-render when a new object reference is emitted (Object.is default)", () => {
      const state = signal({ default: { a: 1, b: 2 } })
      const renders = vi.fn()

      renderHook(() => {
        renders()

        return useSignalValue(state)
      })

      expect(renders).toHaveBeenCalledTimes(1)

      act(() => {
        state.update({ a: 1, b: 2 })
      })

      // Same shape, new reference — Object.is treats it as different.
      expect(renders).toHaveBeenCalledTimes(2)
    })

    it("should re-render when an object with different keys is emitted", () => {
      const state = signal({ default: { a: 1, b: 2 } })
      const renders = vi.fn()

      const { result } = renderHook(() => {
        renders()

        return useSignalValue(state)
      })

      expect(renders).toHaveBeenCalledTimes(1)

      act(() => {
        state.update({ a: 1, b: 3 })
      })

      expect(renders).toHaveBeenCalledTimes(2)
      expect(result.current).toEqual({ a: 1, b: 3 })
    })
  })

  describe("With selector", () => {
    it("should apply the selector on first render", () => {
      const state = signal({ default: { count: 5, label: "hi" } })

      const { result } = renderHook(() =>
        useSignalValue(state, (value) => value.count),
      )

      expect(result.current).toBe(5)
    })

    it("should re-render with selected value when underlying signal changes", () => {
      const state = signal({ default: { count: 0, label: "a" } })

      const { result } = renderHook(() =>
        useSignalValue(state, (value) => value.count),
      )

      expect(result.current).toBe(0)

      act(() => {
        state.update({ count: 1, label: "a" })
      })

      expect(result.current).toBe(1)
    })

    it("should not re-render when selector output is unchanged", () => {
      const state = signal({ default: { count: 0, label: "a" } })
      const renders = vi.fn()

      const { result } = renderHook(() => {
        renders()

        return useSignalValue(state, (value) => value.count)
      })

      expect(renders).toHaveBeenCalledTimes(1)
      expect(result.current).toBe(0)

      act(() => {
        state.update({ count: 0, label: "different" })
      })

      expect(renders).toHaveBeenCalledTimes(1)
      expect(result.current).toBe(0)
    })

    it("should re-render when a fresh-but-shape-equal object is selected (Object.is default)", () => {
      const state = signal({ default: { a: 1, b: 2, c: 3 } })
      const renders = vi.fn()

      const { result } = renderHook(() => {
        renders()

        return useSignalValue(state, (value) => ({ a: value.a, b: value.b }))
      })

      expect(renders).toHaveBeenCalledTimes(1)

      act(() => {
        state.update({ a: 1, b: 2, c: 999 })
      })

      // Without an opt-in equality fn, the new object reference makes
      // Object.is fail and the consumer re-renders.
      expect(renders).toHaveBeenCalledTimes(2)
      expect(result.current).toEqual({ a: 1, b: 2 })
    })

    it("should not return a stable reference across rerenders by default", () => {
      const state = signal({ default: { a: 1, b: 2 } })

      const { result, rerender } = renderHook(() =>
        useSignalValue(state, (value) => ({ a: value.a })),
      )

      const firstReference = result.current

      rerender()

      // Inline selector + Object.is default → new reference each render.
      expect(result.current).not.toBe(firstReference)
      expect(result.current).toEqual(firstReference)
    })

    it("should handle a selector that returns undefined", () => {
      const state = signal<{ x?: number }>({ default: {} })

      const { result } = renderHook(() => useSignalValue(state, (v) => v.x))

      expect(result.current).toBeUndefined()

      act(() => {
        state.update({ x: 7 })
      })

      expect(result.current).toBe(7)

      act(() => {
        state.update({})
      })

      expect(result.current).toBeUndefined()
    })

    it("should handle a selector that returns null", () => {
      const state = signal<{ x: number | null }>({ default: { x: null } })

      const { result } = renderHook(() => useSignalValue(state, (v) => v.x))

      expect(result.current).toBeNull()

      act(() => {
        state.update({ x: 42 })
      })

      expect(result.current).toBe(42)

      act(() => {
        state.update({ x: null })
      })

      expect(result.current).toBeNull()
    })

    it("should distinguish null from undefined under Object.is", () => {
      const state = signal<{ x: number | null | undefined }>({
        default: { x: undefined },
      })

      const renders = vi.fn()

      const { result } = renderHook(() => {
        renders()
        return useSignalValue(state, (v) => v.x)
      })

      expect(result.current).toBeUndefined()
      expect(renders).toHaveBeenCalledTimes(1)

      act(() => {
        state.update({ x: null })
      })

      // Object.is(undefined, null) === false → re-render
      expect(result.current).toBeNull()
      expect(renders).toHaveBeenCalledTimes(2)
    })

    it("should propagate SIGNAL_RESET through a selector", () => {
      const state = signal({ default: { count: 5, label: "hi" } })

      const { result } = renderHook(() => useSignalValue(state, (v) => v.count))

      expect(result.current).toBe(5)

      act(() => {
        state.update({ count: 10, label: "hi" })
      })

      expect(result.current).toBe(10)

      act(() => {
        state.update(SIGNAL_RESET)
      })

      expect(result.current).toBe(5)
    })

    it("should let a selector error propagate to React's error boundary", () => {
      const state = signal<{ value: number }>({ default: { value: 1 } })
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      class ErrorBoundary extends ReactComponent<
        { children: ReactNode; onError: (error: Error) => void },
        { hasError: boolean }
      > {
        state = { hasError: false }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        componentDidCatch(error: Error) {
          this.props.onError(error)
        }

        render() {
          if (this.state.hasError) return <span data-testid="boom">boom</span>
          return this.props.children
        }
      }

      const Consumer: FC = () => {
        const value = useSignalValue(state, (v) => {
          if (v.value < 0) throw new Error("negative not allowed")
          return v.value
        })
        return <span data-testid="value">{value}</span>
      }

      let caught: Error | undefined

      render(
        <ErrorBoundary
          onError={(error) => {
            caught = error
          }}
        >
          <Consumer />
        </ErrorBoundary>,
      )

      expect(screen.getByTestId("value").textContent).toBe("1")
      expect(caught).toBeUndefined()

      act(() => {
        state.update({ value: -1 })
      })

      expect(caught?.message).toBe("negative not allowed")
      expect(screen.getByTestId("boom").textContent).toBe("boom")

      consoleSpy.mockRestore()
    })
  })

  describe("With equalityFn (opt-in)", () => {
    it("should not re-render when selector output is shallow-equal under isShallowEqual", () => {
      const state = signal({ default: { a: 1, b: 2, c: 3 } })
      const renders = vi.fn()

      const { result } = renderHook(() => {
        renders()

        return useSignalValue(
          state,
          (value) => ({ a: value.a, b: value.b }),
          isShallowEqual,
        )
      })

      expect(renders).toHaveBeenCalledTimes(1)

      act(() => {
        state.update({ a: 1, b: 2, c: 999 })
      })

      expect(renders).toHaveBeenCalledTimes(1)
      expect(result.current).toEqual({ a: 1, b: 2 })
    })

    it("should return a stable reference across rerenders under isShallowEqual", () => {
      const state = signal({ default: { a: 1, b: 2 } })

      const { result, rerender } = renderHook(() =>
        useSignalValue(state, (value) => ({ a: value.a }), isShallowEqual),
      )

      const firstReference = result.current

      rerender()
      rerender()
      rerender()

      expect(result.current).toBe(firstReference)
    })

    it("should not re-render when source emits a shape-equal object under isShallowEqual", () => {
      const state = signal({ default: { a: 1, b: 2 } })
      const renders = vi.fn()

      renderHook(() => {
        renders()

        return useSignalValue(state, (value) => value, isShallowEqual)
      })

      expect(renders).toHaveBeenCalledTimes(1)

      act(() => {
        state.update({ a: 1, b: 2 })
      })

      expect(renders).toHaveBeenCalledTimes(1)
    })

    it("should respect a custom equalityFn", () => {
      const state = signal({ default: { items: [1, 2, 3] } })
      const renders = vi.fn()

      const arrayEqual = (a: { items: number[] }, b: { items: number[] }) =>
        a.items.length === b.items.length &&
        a.items.every((v, i) => v === b.items[i])

      renderHook(() => {
        renders()

        return useSignalValue(state, (v) => ({ items: v.items }), arrayEqual)
      })

      expect(renders).toHaveBeenCalledTimes(1)

      act(() => {
        state.update({ items: [1, 2, 3] })
      })

      expect(renders).toHaveBeenCalledTimes(1)

      act(() => {
        state.update({ items: [1, 2, 4] })
      })

      expect(renders).toHaveBeenCalledTimes(2)
    })
  })

  describe("Selector call efficiency", () => {
    it("should not call a stable selector again when nothing changed", () => {
      const state = signal({ default: { count: 1 } })
      const selector = vi.fn((v: { count: number }) => v.count)

      const { rerender } = renderHook(() => useSignalValue(state, selector))

      const initialCalls = selector.mock.calls.length

      rerender()
      rerender()
      rerender()

      expect(selector.mock.calls.length).toBe(initialCalls)
    })

    it("should call a stable selector exactly once per emitted reference", () => {
      const state = signal({ default: { count: 1 } })
      const selector = vi.fn((v: { count: number }) => v.count)

      renderHook(() => useSignalValue(state, selector))

      const callsAfterMount = selector.mock.calls.length

      act(() => {
        state.update({ count: 2 })
      })

      expect(selector.mock.calls.length).toBe(callsAfterMount + 1)

      act(() => {
        state.update({ count: 2 })
      })

      // New reference (different object) → selector runs again, once.
      expect(selector.mock.calls.length).toBe(callsAfterMount + 2)
    })

    it("should not call selector when signal emits the same primitive reference", () => {
      const state = signal({ default: 7 })
      const selector = vi.fn((v: number) => v * 2)

      renderHook(() => useSignalValue(state, selector))

      const initialCalls = selector.mock.calls.length

      act(() => {
        state.update(7)
      })

      // Same primitive — sourceValue reference unchanged, fast path returns cached
      expect(selector.mock.calls.length).toBe(initialCalls)
    })

    it("should call inline selector each render (different identity each time)", () => {
      const state = signal({ default: 1 })
      let calls = 0

      const { rerender } = renderHook(() =>
        useSignalValue(state, (v) => {
          calls++
          return v
        }),
      )

      const callsAfterMount = calls

      rerender()

      expect(calls).toBe(callsAfterMount + 1)
    })
  })

  describe("Inline (non-memoized) selectors", () => {
    it("should not infinite-loop when inline selector returns a fresh object each call", () => {
      const state = signal({ default: { x: 1, y: 2 } })
      const renders = vi.fn()

      const { result } = renderHook(() => {
        renders()

        return useSignalValue(state, (value) => ({ ...value }), isShallowEqual)
      })

      expect(renders).toHaveBeenCalledTimes(1)
      expect(result.current).toEqual({ x: 1, y: 2 })

      act(() => {
        state.update({ x: 1, y: 2 })
      })

      expect(renders).toHaveBeenCalledTimes(1)
    })

    it("should pick up selector closure changes without manual memoization", () => {
      const state = signal({ default: { items: [10, 20, 30, 40] } })

      const { result, rerender } = renderHook(
        ({ index }: { index: number }) =>
          useSignalValue(state, (value) => value.items[index]),
        { initialProps: { index: 0 } },
      )

      expect(result.current).toBe(10)

      rerender({ index: 2 })

      expect(result.current).toBe(30)

      rerender({ index: 3 })

      expect(result.current).toBe(40)
    })

    it("should reflect both selector and signal changes interleaved", () => {
      const state = signal({ default: { a: 1, b: 100 } })

      const { result, rerender } = renderHook(
        ({ key }: { key: "a" | "b" }) =>
          useSignalValue(state, (value) => value[key]),
        { initialProps: { key: "a" } },
      )

      expect(result.current).toBe(1)

      act(() => {
        state.update({ a: 2, b: 200 })
      })

      expect(result.current).toBe(2)

      rerender({ key: "b" })

      expect(result.current).toBe(200)

      act(() => {
        state.update({ a: 3, b: 300 })
      })

      expect(result.current).toBe(300)
    })

    it("should react to selectors that close over component state", () => {
      const state = signal({
        default: { foo: "FOO", bar: "BAR", baz: "BAZ" },
      })

      const Component: FC = () => {
        const [field, setField] = useState<"foo" | "bar" | "baz">("foo")
        const value = useSignalValue(state, (v) => v[field])

        return (
          <div>
            <span data-testid="value">{value}</span>
            <button
              type="button"
              data-testid="next"
              onClick={() => {
                setField((f) =>
                  f === "foo" ? "bar" : f === "bar" ? "baz" : "foo",
                )
              }}
            >
              next
            </button>
          </div>
        )
      }

      render(<Component />)

      expect(screen.getByTestId("value").textContent).toBe("FOO")

      act(() => {
        screen.getByTestId("next").click()
      })

      expect(screen.getByTestId("value").textContent).toBe("BAR")

      act(() => {
        screen.getByTestId("next").click()
      })

      expect(screen.getByTestId("value").textContent).toBe("BAZ")
    })
  })

  describe("Subscription lifecycle", () => {
    it("should unsubscribe on unmount", () => {
      const state = signal({ default: 0 })

      const { unmount } = renderHook(() => useSignalValue(state))

      expect(state.observers.length).toBeGreaterThan(0)

      unmount()

      expect(state.observers.length).toBe(0)
    })

    it("should keep a single subscription across rerenders even with inline selectors", () => {
      // Inline selectors create a new function identity on every render. The
      // subscribe callback must remain referentially stable (it depends only
      // on the signal), so React should never resubscribe on rerender. A
      // handful of rerenders is enough to catch a regression that would
      // resubscribe per render.
      const state = signal({ default: { a: 1 } })

      const { rerender, unmount } = renderHook(() =>
        useSignalValue(state, (value) => ({ ...value })),
      )

      rerender()
      rerender()
      rerender()

      expect(state.observers.length).toBe(1)

      unmount()

      expect(state.observers.length).toBe(0)
    })

    it("should not invoke React's onChange synchronously on subscribe (BehaviorSubject initial emission is filtered)", () => {
      // `Signal extends BehaviorSubject`, which synchronously emits its current
      // value when you subscribe. The hook wraps the subscription with skip(1)
      // so React's `onChange` only fires on real updates — never as a side
      // effect of subscribing. Verified here by spying on `Signal.prototype`'s
      // `subscribe` and asserting that the listener installed by the pipe is
      // *not* React's onChange itself: it's an internal rxjs Subscriber whose
      // job is to filter the first emission.
      const state = signal({ default: 1 })

      const subscribeSpy = vi.spyOn(state, "subscribe")

      let renderCount = 0
      const Component: FC = () => {
        renderCount++
        useSignalValue(state)
        return null
      }

      render(<Component />)

      // The hook subscribes once (via the piped observable's internal subscribe),
      // and the synchronous initial emission of the BehaviorSubject does not
      // cause an additional render.
      expect(subscribeSpy).toHaveBeenCalledTimes(1)
      expect(renderCount).toBe(1)

      // Subsequent emissions DO propagate.
      act(() => {
        state.update(2)
      })

      expect(renderCount).toBe(2)

      subscribeSpy.mockRestore()
    })

    it("should resubscribe and read fresh value when switching signals", () => {
      const a = signal({ default: 100 })
      const b = signal({ default: 200 })

      const { result, rerender } = renderHook(
        ({ which }: { which: "a" | "b" }) =>
          useSignalValue(which === "a" ? a : b),
        { initialProps: { which: "a" } },
      )

      expect(result.current).toBe(100)
      expect(a.observers.length).toBe(1)
      expect(b.observers.length).toBe(0)

      rerender({ which: "b" })

      expect(result.current).toBe(200)
      expect(a.observers.length).toBe(0)
      expect(b.observers.length).toBe(1)

      act(() => {
        b.update(201)
      })

      expect(result.current).toBe(201)
    })
  })

  describe("StrictMode", () => {
    it("should work correctly under StrictMode (double-mount)", () => {
      const state = signal({ default: 7 })

      const Component: FC = () => {
        const value = useSignalValue(state)

        return <div data-testid="value">{value}</div>
      }

      render(
        <StrictMode>
          <Component />
        </StrictMode>,
      )

      expect(screen.getByTestId("value").textContent).toBe("7")

      act(() => {
        state.update(8)
      })

      expect(screen.getByTestId("value").textContent).toBe("8")
    })

    it("should not leave dangling subscriptions after StrictMode mount/unmount cycle", () => {
      const state = signal({ default: 0 })

      const Component: FC = () => {
        useSignalValue(state)

        return null
      }

      const { unmount } = render(
        <StrictMode>
          <Component />
        </StrictMode>,
      )

      unmount()

      expect(state.observers.length).toBe(0)
    })
  })

  describe("Effect dependencies", () => {
    it("should not retrigger downstream effects when selector output is shallow-equal (with isShallowEqual)", () => {
      const state = signal({ default: { a: 1, b: 2 } })
      const effect = vi.fn()

      const Component: FC = () => {
        const value = useSignalValue(state, (v) => ({ a: v.a }), isShallowEqual)

        useEffect(() => {
          effect(value)
        }, [value])

        return null
      }

      render(<Component />)

      expect(effect).toHaveBeenCalledTimes(1)

      act(() => {
        state.update({ a: 1, b: 999 })
      })

      expect(effect).toHaveBeenCalledTimes(1)

      act(() => {
        state.update({ a: 2, b: 999 })
      })

      expect(effect).toHaveBeenCalledTimes(2)
      expect(effect).toHaveBeenLastCalledWith({ a: 2 })
    })
  })

  describe("VirtualSignal", () => {
    const Wrapper: FC<PropsWithChildren> = ({ children }) => (
      <SignalContextProvider>{children}</SignalContextProvider>
    )

    it("should resolve a virtual signal through context", () => {
      const vSignal = virtualSignal({ key: "v1", default: 42 })

      const { result } = renderHook(() => useSignalValue(vSignal), {
        wrapper: Wrapper,
      })

      expect(result.current).toBe(42)
    })

    it("should apply selector to virtual signal value", () => {
      const vSignal = virtualSignal({
        key: "v2",
        default: { count: 3 },
      })

      const { result } = renderHook(
        () => useSignalValue(vSignal, (v) => v.count * 2),
        { wrapper: Wrapper },
      )

      expect(result.current).toBe(6)
    })

    it("should re-render when the underlying virtual signal value changes", () => {
      const vSignal = virtualSignal({ key: "v3", default: { count: 0 } })

      let captured: ReturnType<typeof useMakeOrRetrieveSignal> | undefined

      const Probe: FC = () => {
        captured = useMakeOrRetrieveSignal(vSignal)
        return null
      }

      const Reader: FC<{ render: () => void }> = ({ render }) => {
        render()
        const value = useSignalValue(vSignal, (v) => v.count)
        return <span data-testid="virtual-value">{value}</span>
      }

      const renders = vi.fn()

      render(
        <Wrapper>
          <Probe />
          <Reader render={renders} />
        </Wrapper>,
      )

      expect(captured).toBeDefined()
      expect(screen.getByTestId("virtual-value").textContent).toBe("0")
      expect(renders).toHaveBeenCalledTimes(1)

      // Drive the underlying resolved signal directly. The hook should pick it up.
      act(() => {
        captured?.next({ count: 5 })
      })

      expect(screen.getByTestId("virtual-value").textContent).toBe("5")
      expect(renders).toHaveBeenCalledTimes(2)
    })
  })
})
