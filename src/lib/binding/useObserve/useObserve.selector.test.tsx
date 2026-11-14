import { renderHook } from "@testing-library/react"
import { act, useEffect } from "react"
import { BehaviorSubject, distinctUntilChanged, map, of } from "rxjs"
import { expect, it } from "vitest"
import { filterObjectByKey } from "../../utils/filterObjectByKey"
import { isShallowEqual } from "../../utils/shallowEqual"
import type { UseObserveResult } from "./types"
import { useObserve } from "./useObserve"

it("should return the selected keys", async () => {
  const values: Array<{ foo: string } | undefined> = []
  const source$ = of({ foo: "foo" }).pipe(
    map((data) => filterObjectByKey(data, ["foo"])),
    distinctUntilChanged(isShallowEqual),
  )

  renderHook(() => {
    const value = useObserve(source$)

    values.push(value.data)
  }, {})

  expect(values).toEqual([undefined, { foo: "foo" }])
})

it("should not re-render when the selected keys don't change", async () => {
  const values: Array<UseObserveResult<{ a: string }, { a: string }>> = []
  const source$ = new BehaviorSubject({ a: "a", b: "b" })

  renderHook(() => {
    const value = useObserve(
      () =>
        source$.pipe(
          map((data) => filterObjectByKey(data, ["a"])),
          distinctUntilChanged(isShallowEqual),
        ),
      { defaultValue: source$.value },
      [],
    )

    useEffect(() => {
      values.push(value)
    }, [value])
  }, {})

  expect(values.at(-1)).toEqual({
    data: { a: "a" },
    error: undefined,
    status: "success",
    observableState: "live",
  })

  const renders = values.length

  act(() => {
    source$.next({ a: "a", b: "c" })
  })

  expect(values.length).toBe(renders)
})

it("should re-render when the selected keys change", async () => {
  const values: Array<{ a: string } | undefined> = []
  const source$ = new BehaviorSubject({ a: "a", b: "b" })

  renderHook(() => {
    const value = useObserve(
      () =>
        source$.pipe(
          map((data) => filterObjectByKey(data, ["a"])),
          distinctUntilChanged(isShallowEqual),
        ),
      { defaultValue: source$.value },
      [],
    )

    useEffect(() => {
      values.push(value.data)
    }, [value])
  }, {})

  expect(values.at(-1)).toEqual({ a: "a" })

  const renders = values.length

  act(() => {
    source$.next({ a: "b", b: "c" })
  })

  expect(values.at(-1)).toEqual({ a: "b" })
  expect(values.length).toBe(renders + 1)
})
