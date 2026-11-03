import { render, renderHook } from "@testing-library/react"
import { act, Suspense, startTransition, use, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { useUnmount } from "./useUnmount"

describe("useUnmount", () => {
  it("should call the fn of the last render when the component unmounts", () => {
    const first = vi.fn()
    const latest = vi.fn()
    const { rerender, unmount } = renderHook(({ fn }) => useUnmount(fn), {
      initialProps: { fn: first },
    })

    rerender({ fn: latest })
    unmount()

    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
  })

  it("should call the committed fn when React drops a render", async () => {
    const never = new Promise<never>(() => {})
    const Suspends = () => {
      "use no memo"

      use(never)

      return null
    }
    const committed = vi.fn()
    const dropped = vi.fn()
    const rendered: Array<() => void> = []
    let setFn: (fn: () => void) => void = () => {}

    const Comp = () => {
      "use no memo"

      const [fn, set] = useState<() => void>(() => committed)
      setFn = set
      rendered.push(fn)
      useUnmount(fn)

      return (
        <Suspense fallback={null}>{fn === dropped && <Suspends />}</Suspense>
      )
    }

    const { unmount } = render(<Comp />)

    await act(async () => {
      startTransition(() => setFn(() => dropped))
    })

    unmount()

    expect(rendered).toContain(dropped)
    expect(dropped).not.toHaveBeenCalled()
    expect(committed).toHaveBeenCalledTimes(1)
  })
})
