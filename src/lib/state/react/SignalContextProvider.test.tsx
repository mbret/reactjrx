import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react"
import { type FC, type PropsWithChildren, StrictMode, useEffect } from "react"
import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest"
import { waitForTimeout } from "../../../tests/utils"
import { virtualSignal } from "../Signal"
import type { SignalContext } from "../SignalContext"
import {
  SignalContextProvider,
  useMakeOrRetrieveSignal,
  useSignalContext,
} from "./SignalContextProvider"

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
        const context = useSignalContext()
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
      // Spy on SignalContext constructor to track new instances
      let firstContext: SignalContext | undefined
      let secondContext: SignalContext | undefined

      const TestConsumerWithEffect = () => {
        const context = useSignalContext()

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

      // Unmount to trigger cleanup
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
        () => useMakeOrRetrieveSignal(testVirtualSignal),
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
        () => useMakeOrRetrieveSignal(testVirtualSignal1),
        {
          wrapper: TestWrapper,
        },
      )

      const { result: result2 } = renderHook(
        () => useMakeOrRetrieveSignal(testVirtualSignal2),
        {
          wrapper: TestWrapper,
        },
      )

      expect(result1.current).not.toBe(result2.current)
      expect(result1.current?.value).toBe("test1")
      expect(result2.current?.value).toBe("test2")
    })

    it("should return undefined when no virtual signal is provided", () => {
      const { result } = renderHook(() => useMakeOrRetrieveSignal(), {
        wrapper: TestWrapper,
      })

      expect(result.current).toBe(undefined)
    })
  })

  describe("Cleanup", () => {
    it("should call destroy on the context when component unmounts", () => {
      const spies: { context: SignalContext; spy: MockInstance }[] = []

      // Create a test component that gets the context
      const TestComponent = () => {
        const context = useSignalContext()

        // Spy on the destroy method
        useEffect(() => {
          if (spies.find((s) => s.context === context)) return

          spies.push({ context, spy: vi.spyOn(context, "destroy") })
        }, [context])

        return null
      }

      const { unmount } = render(
        <StrictMode>
          <SignalContextProvider>
            <TestComponent />
          </SignalContextProvider>
        </StrictMode>,
      )

      // Unmount to trigger cleanup
      unmount()

      // Check if destroy was called during cleanup
      expect(spies.length).toBe(2)
      expect(spies[0]?.spy).toHaveBeenCalled()
      expect(spies[1]?.spy).toHaveBeenCalled()
    })
  })

  describe("Context Provider Value", () => {
    it("should provide the same context instance on re-renders", () => {
      // Create a component that tracks context instances
      const instances: SignalContext[] = []

      const ContextTracker = () => {
        const context = useSignalContext()

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
