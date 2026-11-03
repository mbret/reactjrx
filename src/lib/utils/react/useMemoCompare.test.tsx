import { render, renderHook } from "@testing-library/react"
import { act, Suspense, startTransition, use, useState } from "react"
import { describe, expect, it } from "vitest"
import { useMemoCompare } from "./useMemoCompare"

type Item = { id: number }

const sameId = (a: Item, b: Item) => a.id === b.id

describe("useMemoCompare", () => {
  it("should return the previous value while compare finds the new one equal", () => {
    const first = { id: 1 }
    const second = { id: 2 }
    const { result, rerender } = renderHook(
      ({ value }) => useMemoCompare(value, sameId),
      { initialProps: { value: first } },
    )

    rerender({ value: { id: 1 } })

    expect(result.current).toBe(first)

    rerender({ value: second })

    expect(result.current).toBe(second)
  })

  it("should compare with the committed value when React drops a render", async () => {
    const never = new Promise<never>(() => {})
    const Suspends = () => {
      "use no memo"

      use(never)

      return null
    }
    const first = { id: 1 }
    const rendered: number[] = []
    let memoized: Item | undefined
    let setValue: (value: Item) => void = () => {}

    const Comp = () => {
      "use no memo"

      const [value, set] = useState(first)
      setValue = set
      rendered.push(value.id)
      memoized = useMemoCompare(value, sameId)

      return (
        <Suspense fallback={null}>{value.id === 2 && <Suspends />}</Suspense>
      )
    }

    render(<Comp />)

    await act(async () => {
      startTransition(() => setValue({ id: 2 }))
    })

    await act(async () => {
      setValue({ id: 1 })
    })

    expect(rendered).toContain(2)
    expect(memoized).toBe(first)
  })
})
