import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react"
import {
  Activity,
  type FC,
  type PropsWithChildren,
  StrictMode,
  useContext,
  useEffect,
} from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { waitForTimeout } from "../../../tests/utils"
import { virtualSignal } from "../Signal"
import type { SignalContext } from "../SignalContext"
import { SignalContextProvider } from "./SignalContextProvider"
import { SignalReactContext } from "./SignalReactContext"
import { useSignal } from "./useSignal"
import { useSignalReference } from "./useSignalReference"

// Helper wrapper component for testing context
const TestWrapper: FC<PropsWithChildren> = ({ children }) => {
  return <SignalContextProvider>{children}</SignalContextProvider>
}

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("SignalContextProvider", () => {
  describe("Context Provision", () => {
    it("should provide a SignalContext instance to its children", () => {
      // Create a component that accesses the context
      const TestConsumer = () => {
        const context = useContext(SignalReactContext)
        return (
          <div data-testid="context-value">
            {context ? "Context Exists" : "No Context"}
          </div>
        )
      }

      render(
        <StrictMode>
          <SignalContextProvider>
            <TestConsumer />
          </SignalContextProvider>
        </StrictMode>,
      )

      expect(screen.getByTestId("context-value").textContent).toBe(
        "Context Exists",
      )
    })

    it("should create a new context when the component is re-mounted", async () => {
      let firstContext: SignalContext | undefined
      let secondContext: SignalContext | undefined

      const TestConsumerWithEffect = () => {
        const context = useContext(SignalReactContext)

        useEffect(() => {
          if (!firstContext) {
            firstContext = context
          } else {
            secondContext = context
          }
        }, [context])

        return null
      }

      const { unmount } = render(
        <StrictMode>
          <SignalContextProvider>
            <TestConsumerWithEffect />
          </SignalContextProvider>
        </StrictMode>,
      )

      unmount()

      // Rerender to create a new context
      render(
        <StrictMode>
          <SignalContextProvider>
            <TestConsumerWithEffect />
          </SignalContextProvider>
        </StrictMode>,
      )

      await act(async () => {
        // Wait for effects to run
        await waitForTimeout(0)
      })

      // Check that we have two different context instances
      expect(firstContext).not.toBe(undefined)
      expect(secondContext).not.toBe(undefined)
      expect(firstContext).not.toBe(secondContext)
    })
  })

  describe("Signal Management", () => {
    it("should retrieve the same signal for the same virtual signal", () => {
      const testVirtualSignal = virtualSignal({ default: "test" })

      const { result, rerender } = renderHook(
        () => useSignalReference(testVirtualSignal),
        {
          wrapper: TestWrapper,
        },
      )

      const firstSignal = result.current

      // Rerender to check if we get the same signal instance
      rerender()

      expect(result.current).toBe(firstSignal)
    })

    it("should create different signals for different virtual signals", () => {
      const testVirtualSignal1 = virtualSignal({ default: "test1" })
      const testVirtualSignal2 = virtualSignal({ default: "test2" })

      const { result: result1 } = renderHook(
        () => useSignalReference(testVirtualSignal1),
        {
          wrapper: TestWrapper,
        },
      )

      const { result: result2 } = renderHook(
        () => useSignalReference(testVirtualSignal2),
        {
          wrapper: TestWrapper,
        },
      )

      expect(result1.current).not.toBe(result2.current)
      expect(result1.current.value).toBe("test1")
      expect(result2.current.value).toBe("test2")
    })
  })

  describe("Given a virtual signal used without a provider", () => {
    it("should throw", () => {
      const counter = virtualSignal({ default: 0 })
      vi.spyOn(console, "error").mockImplementation(() => {})

      expect(() => renderHook(() => useSignal(counter))).toThrow(
        "A virtual signal must be used within a SignalContextProvider",
      )
    })
  })

  describe("Given a provider hidden, then shown, by <Activity>", () => {
    it("should keep the values of its virtual signals", async () => {
      const counter = virtualSignal({ default: 0 })
      const Child = () => {
        "use no memo"
        const [value, setValue] = useSignal(counter)

        return (
          <button type="button" data-testid="btn" onClick={() => setValue(5)}>
            {value}
          </button>
        )
      }
      const App = ({ mode }: { mode: "visible" | "hidden" }) => {
        "use no memo"

        return (
          <Activity mode={mode}>
            <SignalContextProvider>
              <Child />
            </SignalContextProvider>
          </Activity>
        )
      }

      const { rerender } = render(<App mode="visible" />)
      act(() => screen.getByTestId("btn").click())
      await act(async () => rerender(<App mode="hidden" />))
      await act(async () => rerender(<App mode="visible" />))

      expect(screen.getByTestId("btn").textContent).toBe("5")
    })
  })

  describe("Context Provider Value", () => {
    it("should provide the same context instance on re-renders", () => {
      // Create a component that tracks context instances
      const instances: (SignalContext | undefined)[] = []

      const ContextTracker = () => {
        const context = useContext(SignalReactContext)

        useEffect(() => {
          instances.push(context)
        })

        return null
      }

      const { rerender } = render(
        <SignalContextProvider>
          <ContextTracker />
        </SignalContextProvider>,
      )

      // Force a re-render
      rerender(
        <SignalContextProvider>
          <ContextTracker />
        </SignalContextProvider>,
      )

      // The context should be stable across renders
      expect(instances.length).toBeGreaterThan(1)
      instances.forEach((instance) => {
        expect(instance).toBe(instances[0])
      })
    })
  })
})
