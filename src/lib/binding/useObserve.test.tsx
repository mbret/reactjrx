import { afterEach, describe, expect, it } from "vitest"
import { BehaviorSubject, Subject, map, of, timer } from "rxjs"
import { useObserve } from "./useObserve"
import { act, render, renderHook, cleanup } from "@testing-library/react"
import React, { memo, useEffect, useRef } from "react"
import { useBehaviorSubject } from "./useBehaviorSubject"

afterEach(() => {
  cleanup()
})

describe("useObserve", () => {
  describe("Given a non BehaviorSubject observable", () => {
    it("should return undefined before subscription", async () => {
      const values: Array<string | undefined> = []
      const source$ = of("foo")

      renderHook(() => {
        values.push(useObserve(source$))
      }, {})

      expect(values[0]).toBe(undefined)
    })
  })

  describe("Given a BehaviorSubject observable", () => {
    it("should return subject current value before subscription", async () => {
      const values: string[] = []
      const source$ = new BehaviorSubject("foo")

      renderHook(() => {
        values.push(useObserve(source$))
      }, {})

      expect(values[0]).toBe("foo")
    })
  })

  it("should return custom default value", async ({ expect }) => {
    const source$ = new Subject<number>()

    const { result } = renderHook(
      () => useObserve(source$, { defaultValue: null }),
      {}
    )

    expect(result.current).toBe(null)
  })

  it("should return the value after subscription", async ({ expect }) => {
    const source$ = of(123)

    const { result } = renderHook(() => useObserve(source$), {})

    await new Promise((resolve) => setTimeout(resolve, 1))

    expect(result.current).toBe(123)
  })

  it("should return new value after a stream change", async ({ expect }) => {
    const source$ = new Subject<number>()

    const { result } = renderHook(() => useObserve(source$), {})

    await new Promise((resolve) => setTimeout(resolve, 1))

    expect(result.current).toBe(undefined)

    act(() => {
      source$.next(0)
    })

    expect(result.current).toBe(0)

    act(() => {
      source$.next(1)
    })

    expect(result.current).toBe(1)
  })

  it("should return correct result with observable under normal mode", async () => {
    const source = timer(1).pipe(map(() => 2))

    const Comp = () => {
      const a = useObserve(source)

      return <>{a}</>
    }

    const { findByText } = render(<Comp />)

    expect(await findByText("2")).toBeDefined()
  })

  it("should return correct result with observable under strict mode", async () => {
    const source = timer(1).pipe(map(() => 2))

    const Comp = () => {
      const a = useObserve(source)

      return <>{a}</>
    }

    const { findByText } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>
    )

    expect(await findByText("2")).toBeDefined()
  })

  it("should return correct result with use ref source under strict mode", async () => {
    const Comp = memo(() => {
      const source = useBehaviorSubject(3)
      const result = useObserve(() => source.current, [])

      useEffect(() => {
        const timer = setTimeout(() => {
          source.current.next(4)
        }, 5)

        return () => {
          clearTimeout(timer)
        }
      }, [])

      return <>{result}</>
    })

    const { findByText } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>
    )

    expect(await findByText("4")).toBeDefined()
  })

  it("should return correct result with factory under strict mode", async () => {
    const Comp = () => {
      const data = useObserve(() => of(3), [])

      return <>{data}</>
    }

    const { getByText } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>
    )

    expect(getByText("3")).toBeDefined()
  })

  it("should disable query once render count reach 10 and therefore return 10", async () => {
    const Comp = memo(() => {
      const renderCount = useRef(0)

      const data = useObserve(
        () => of(renderCount.current),
        [renderCount.current]
      )

      useEffect(() => {
        if (renderCount.current < 10) {
          renderCount.current++
        }
      })

      return <>{data}</>
    })

    const { findByText } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>
    )

    expect(await findByText("10")).toBeDefined()
  })
})
