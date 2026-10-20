import { renderHook } from "@testing-library/react"
import { StrictMode, useRef } from "react"
import { describe, expect, it } from "vitest"
import { useLiveBehaviorSubject } from "./useLiveBehaviorSubject"

/**
 * Renders the hook and records every value its subject emits, subscribing
 * during the first render so that emissions from the mount effect are seen.
 */
const renderAndRecord = (
  initialValue: number,
  options: { wrapper?: typeof StrictMode } = {},
) => {
  const emitted: number[] = []

  const utils = renderHook(
    ({ value }) => {
      const subject = useLiveBehaviorSubject(value)
      const isSubscribed = useRef(false)

      if (!isSubscribed.current) {
        isSubscribed.current = true
        subject.subscribe((emittedValue) => emitted.push(emittedValue))
      }

      return subject
    },
    { initialProps: { value: initialValue }, ...options },
  )

  return { ...utils, emitted }
}

describe("useLiveBehaviorSubject", () => {
  it("emits the initial value once on mount", () => {
    const { emitted } = renderAndRecord(1)

    expect(emitted).toEqual([1])
  })

  it("emits the initial value once on mount in StrictMode", () => {
    const { emitted } = renderAndRecord(1, { wrapper: StrictMode })

    expect(emitted).toEqual([1])
  })

  it("emits each new value", () => {
    const { emitted, rerender } = renderAndRecord(1)

    rerender({ value: 2 })
    rerender({ value: 2 })
    rerender({ value: 3 })

    expect(emitted).toEqual([1, 2, 3])
  })
})
