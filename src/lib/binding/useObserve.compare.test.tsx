import { renderHook } from "@testing-library/react"
import { act, useEffect } from "react"
import { BehaviorSubject } from "rxjs"
import { describe, expect, it } from "vitest"
import { isShallowEqual } from "../utils/shallowEqual"
import { useObserve } from "./useObserve"

it("should not re-render when the value is same reference", async () => {
  const values: Array<undefined> = []
  const source$ = new BehaviorSubject(undefined)

  renderHook(() => {
    const value = useObserve(source$)

    useEffect(() => {
      values.push(value)
    }, [value])
  }, {})

  expect(values[0]).toEqual(undefined)

  act(() => {
    source$.next(undefined)
  })

  expect(values.length).toBe(1)
})

it("should re-render when the object is same but new reference", async () => {
  const values: Array<{ a: string } | undefined> = []
  const source$ = new BehaviorSubject({ a: "a" })

  renderHook(() => {
    const value = useObserve(source$)

    useEffect(() => {
      values.push(value)
    }, [value])
  }, {})

  expect(values[0]).toEqual({ a: "a" })

  act(() => {
    source$.next({ a: "a" })
  })

  expect(values[1]).toEqual({ a: "a" })
  expect(values.length).toBe(2)
})

it("should not return new value when the hook re-render but the value is the same", async () => {
  const values: Array<{ a: string } | undefined> = []
  const source$ = new BehaviorSubject({ a: "a" })

  const { rerender } = renderHook(() => {
    const value = useObserve(source$)

    useEffect(() => {
      values.push(value)
    }, [value])
  }, {})

  expect(values[0]).toEqual({ a: "a" })

  rerender()
  rerender()

  expect(values.length).toBe(1)
})

describe("given a custom compareFn", () => {
  it("should re-render when the object is same but new reference", async () => {
    const values: Array<{ a: string } | undefined> = []
    const source$ = new BehaviorSubject({ a: "a" })

    renderHook(() => {
      const value = useObserve(source$, {
        compareFn: isShallowEqual,
      })

      useEffect(() => {
        values.push(value)
      }, [value])
    }, {})

    expect(values[0]).toEqual({ a: "a" })

    act(() => {
      source$.next({ a: "a" })
    })

    expect(values.length).toBe(1)
  })

  it("should not return new value when the hook re-render but the value is the same shallow equal", async () => {
    const values: Array<{ a: string } | undefined> = []
    const source$ = new BehaviorSubject({ a: "a" })

    const { rerender } = renderHook(() => {
      const value = useObserve(source$, {
        compareFn: isShallowEqual,
      })

      useEffect(() => {
        values.push(value)
      }, [value])
    }, {})

    expect(values[0]).toEqual({ a: "a" })

    act(() => {
      source$.next({ a: "a" })
    })

    rerender()
    rerender()

    expect(values.length).toBe(1)
  })
})
