import { renderHook } from "@testing-library/react"
import { act, useEffect, useState } from "react"
import { BehaviorSubject } from "rxjs"
import { describe, expect, it } from "vitest"
import { isShallowEqual } from "../../utils/shallowEqual"
import type { UseObserveResult } from "./types"
import { useObserve } from "./useObserve"

it("should not re-render when the value is same reference", async () => {
  const values: Array<UseObserveResult<undefined, undefined>> = []
  const source$ = new BehaviorSubject(undefined)

  renderHook(() => {
    const value = useObserve(source$)

    useEffect(() => {
      values.push(value)
    }, [value])
  }, {})

  expect(values[0]).toEqual({
    data: undefined,
    error: undefined,
    status: "pending",
    observableState: "live",
  })

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
      values.push(value.data)
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
      values.push(value.data)
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
        values.push(value.data)
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
        values.push(value.data)
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

describe("Given a forever true compareFn", () => {
  describe("and a new value is pushed", () => {
    it("should not return the new value", async () => {
      const values: Array<UseObserveResult<number, number>> = []
      const source$ = new BehaviorSubject(1)

      renderHook(() => {
        const value = useObserve(source$, { compareFn: () => true })

        useEffect(() => {
          values.push(value)
        }, [value])
      }, {})

      act(() => {
        source$.next(2)
      })

      expect(values.length).toBe(1)
      expect(values.at(-1)?.data).toBe(1)
    })
  })

  describe("when a new compareFn is provided with forever false", () => {
    describe("and a new value is pushed", () => {
      it("should return the new value", async () => {
        const values: Array<UseObserveResult<number, number>> = []
        const source$ = new BehaviorSubject(1)

        const { result } = renderHook(() => {
          const [compareFn, setCompareFn] = useState(() => () => true)
          const value = useObserve(source$, { compareFn })

          useEffect(() => {
            values.push(value)
          }, [value])

          return { setCompareFn }
        }, {})

        expect(values.length).toBe(1)
        expect(values.at(-1)?.data).toBe(1)

        act(() => {
          result.current.setCompareFn(() => () => false)
        })

        act(() => {
          source$.next(2)
        })

        expect(values.length).toBe(2)
        expect(values.at(-1)?.data).toBe(2)
      })
    })
  })
})
