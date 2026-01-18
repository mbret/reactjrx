import { cleanup, render, renderHook } from "@testing-library/react"
import React, { act, memo, useEffect, useState } from "react"
import { BehaviorSubject, map, type Observable, of, Subject, timer } from "rxjs"
import { afterEach, describe, expect, expectTypeOf, it } from "vitest"
import { waitForTimeout } from "../../../tests/utils"
import { useConstant } from "../../utils/react/useConstant"
import type { UseObserveResult } from "./types"
import { useObserve } from "./useObserve"

afterEach(() => {
  cleanup()
})

describe("useObserve", () => {
  describe("Given a non BehaviorSubject observable", () => {
    it("should return `foo` as first render cycle due to internal optimization and should only have one render cycle", async () => {
      const values: Array<UseObserveResult<string, undefined>> = []
      const source$ = of("foo")

      renderHook(() => {
        values.push(useObserve(source$))
      }, {})

      expect(values[0]?.data).toBe("foo")

      expect(values.length).toBe(1)
    })
  })

  describe("Given a BehaviorSubject observable", () => {
    it("should return subject current value before subscription", async () => {
      const values: string[] = []
      const source$ = new BehaviorSubject("foo")

      renderHook(() => {
        values.push(useObserve(source$).data)
      }, {})

      expect(values[0]).toBe("foo")
    })
  })

  it("should return custom default value", async ({ expect }) => {
    const source$ = new Subject<number>()

    const { result } = renderHook(
      () => useObserve(source$, { defaultValue: null }),
      {},
    )

    expect(result.current).toEqual({
      data: null,
      status: "pending",
      observableState: "live",
      error: undefined,
    })
  })

  it("should return the value after subscription", async ({ expect }) => {
    const source$ = of(123)

    const { result } = renderHook(() => useObserve(source$), {})

    await act(async () => {
      await waitForTimeout(1)
    })

    expect(result.current).toEqual({
      data: 123,
      status: "success",
      observableState: "complete",
      error: undefined,
    })
  })

  it("should return new value after a stream change", async ({ expect }) => {
    const source$ = new Subject<number>()

    const { result } = renderHook(() => useObserve(source$), {})

    await act(async () => {
      await waitForTimeout(1)
    })

    expect(result.current).toEqual({
      data: undefined,
      status: "pending",
      observableState: "live",
      error: undefined,
    })

    act(() => {
      source$.next(0)
    })

    expect(result.current).toEqual({
      data: 0,
      status: "pending",
      observableState: "live",
      error: undefined,
    })

    act(() => {
      source$.next(1)
    })

    expect(result.current).toEqual({
      data: 1,
      status: "pending",
      observableState: "live",
      error: undefined,
    })

    act(() => {
      source$.complete()
    })

    expect(result.current).toEqual({
      data: 1,
      status: "success",
      observableState: "complete",
      error: undefined,
    })
  })

  it("should return correct result with observable under normal mode", async () => {
    const source = timer(1).pipe(map(() => 2))

    const Comp = () => {
      const a = useObserve(source)

      return <>{a.data}</>
    }

    const { findByText } = render(<Comp />)

    expect(await findByText("2")).toBeDefined()
  })

  it("should return correct result with observable under strict mode", async () => {
    const source = timer(1).pipe(map(() => 2))

    const Comp = () => {
      const a = useObserve(source)

      return <>{a.data}</>
    }

    const { findByText } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>,
    )

    expect(await findByText("2")).toBeDefined()
  })

  it("should return correct result with use ref source under strict mode", async () => {
    const Comp = memo(() => {
      const source = useConstant(() => new BehaviorSubject(3))
      const result = useObserve(() => source, [source])

      useEffect(() => {
        const timer = setTimeout(() => {
          source.next(4)
        }, 5)

        return () => {
          clearTimeout(timer)
        }
      }, [source])

      return <>{result.data}</>
    })

    const { findByText } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>,
    )

    expect(await findByText("4")).toBeDefined()
  })

  it("should return correct result with factory under strict mode", async () => {
    const Comp = () => {
      const data = useObserve(() => of(3), [])

      return <>{data.data}</>
    }

    const { getByText } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>,
    )

    expect(getByText("3")).toBeDefined()
  })

  it("should disable query once render count reach 10 and therefore return 10", async () => {
    const Comp = memo(() => {
      const [renderCount, setRenderCount] = useState(0)

      const data = useObserve(() => of(renderCount), [renderCount])

      useEffect(() => {
        if (renderCount < 10) {
          setRenderCount(renderCount + 1)
        }
      }, [renderCount])

      return <>{data.data}</>
    })

    const { findByText } = render(
      <React.StrictMode>
        <Comp />
      </React.StrictMode>,
    )

    expect(await findByText("10")).toBeDefined()
  })

  it("does not re-render when observer complete", async () => {
    const subject = new Subject<number>()
    let numberOfRenders = 0

    const MyComponent = () => {
      useObserve(subject)

      numberOfRenders++

      return null
    }

    render(<MyComponent />)

    expect(numberOfRenders).toBe(1)

    await waitForTimeout(10)

    act(() => {
      subject.next(10)
    })

    expect(numberOfRenders).toBe(2)

    await act(async () => {
      await waitForTimeout(10)
    })

    act(() => {
      subject.complete()
    })

    await act(async () => {
      await waitForTimeout(10)
    })

    // now updated with success state
    expect(numberOfRenders).toBe(3)
  })

  describe("Given a factory that may or may not return an observable", () => {
    it("should type return correctly", async () => {
      renderHook(() => {
        const value = useObserve(
          () => of(1) as Observable<number> | undefined,
          [],
        )

        expectTypeOf(value.data).toEqualTypeOf<number | undefined>()
      }, {})

      expect(true).toBe(true)
    })

    it("should return undefined and then the correct value", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: TODO
      const values: any = []

      renderHook(() => {
        const [res, setRes] = useState<BehaviorSubject<number> | undefined>(
          undefined,
        )

        values.push(useObserve(() => res, [res]))

        useEffect(() => {
          setTimeout(() => {
            setRes(new BehaviorSubject(1))
          }, 1)
        }, [])
      }, {})

      await act(async () => {
        await waitForTimeout(10)
      })

      expect(values).toEqual([
        {
          data: undefined,
          status: "success",
          observableState: "complete",
          error: undefined,
        },
        // still live because not completed
        {
          data: 1,
          status: "pending",
          observableState: "live",
          error: undefined,
        },
      ])
    })
  })
})
