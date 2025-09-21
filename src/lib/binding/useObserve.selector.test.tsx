import { renderHook } from "@testing-library/react"
import { act, useEffect } from "react"
import { BehaviorSubject, of } from "rxjs"
import { expect, it } from "vitest"
import { useObserve } from "./useObserve"

it("should return the selected keys", async () => {
  const values: Array<{ foo: string } | undefined> = []
  const source$ = of({ foo: "foo" })

  renderHook(() => {
    const value = useObserve(source$, ["foo"])

    values.push(value)
  }, {})

  expect(values[0]).toEqual({ foo: "foo" })
  expect(values.length).toBe(1)
})

it("should not re-render when the selected keys don't change", async () => {
  const values: Array<{ a: string } | undefined> = []
  const source$ = new BehaviorSubject({ a: "a", b: "b" })

  renderHook(() => {
    const value = useObserve(source$, ["a"])

    useEffect(() => {
      values.push(value)
    }, [value])
  }, {})

  expect(values[0]).toEqual({ a: "a" })

  act(() => {
    source$.next({ a: "a", b: "c" })
  })

  expect(values.length).toBe(1)
})

it("should re-render when the selected keys change", async () => {
  const values: Array<{ a: string } | undefined> = []
  const source$ = new BehaviorSubject({ a: "a", b: "b" })

  renderHook(() => {
    const value = useObserve(source$, ["a"])

    useEffect(() => {
      values.push(value)
    }, [value])
  }, {})

  expect(values[0]).toEqual({ a: "a" })

  act(() => {
    source$.next({ a: "b", b: "c" })
  })

  expect(values[1]).toEqual({ a: "b" })
  expect(values.length).toBe(2)
})
