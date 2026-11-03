import { render, renderHook } from "@testing-library/react"
import {
  act,
  type RefObject,
  Suspense,
  startTransition,
  use,
  useState,
} from "react"
import { describe, expect, test } from "vitest"
import { useLiveRef } from "./useLiveRef"

describe("useLiveRef", () => {
  test("should return a ref object with an initial value", () => {
    const initialValue = "test"
    const { result } = renderHook(({ value }) => useLiveRef(value), {
      initialProps: { value: initialValue },
    })

    expect(result.current.current).toBe(initialValue)
  })

  test("should update the ref object after layout", () => {
    const initialValue = "test"
    const updatedValue = "updated"
    const { result, rerender } = renderHook(({ value }) => useLiveRef(value), {
      initialProps: { value: initialValue },
    })

    expect(result.current.current).toBe(initialValue)

    rerender({ value: updatedValue })

    act(() => {})

    expect(result.current.current).toBe(updatedValue)
  })

  test("should keep the committed value when React drops a render", async () => {
    const never = new Promise<never>(() => {})
    const Suspends = () => {
      "use no memo"

      use(never)

      return null
    }
    const rendered: string[] = []
    let ref: RefObject<string> | undefined
    let setValue: (value: string) => void = () => {}

    const Comp = () => {
      "use no memo"

      const [value, set] = useState("A")
      setValue = set
      rendered.push(value)
      ref = useLiveRef(value)

      return (
        <>
          <span>{value}</span>
          <Suspense fallback={null}>{value === "B" && <Suspends />}</Suspense>
        </>
      )
    }

    const { container } = render(<Comp />)

    await act(async () => {
      startTransition(() => setValue("B"))
    })

    expect(rendered).toContain("B")
    expect(container.textContent).toBe("A")
    expect(ref?.current).toBe("A")
  })
})
