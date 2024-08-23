import { afterEach, describe, expect, it } from "vitest"
import { type Observable, of, tap } from "rxjs"
import { renderHook, cleanup } from "@testing-library/react"
import { useEffect, useState } from "react"
import { waitForTimeout } from "../../tests/utils"
import { useSubscribe } from "./useSubscribe"

afterEach(() => {
  cleanup()
})

describe("Given a function that returns undefined", () => {
  it("should subscribe and does nothing", async () => {
    const maybeObservableFn = () => undefined as Observable<number> | undefined

    renderHook(() => {
      useSubscribe(maybeObservableFn, [])
    }, {})

    expect(true).toBe(true)
  })

  describe("when the function returns an observable later", () => {
    it("should update and subscribe", async () => {
      let testValue = 0

      renderHook(() => {
        const [value, setValue] = useState<Observable<number> | undefined>(
          undefined
        )

        useSubscribe(
          () =>
            value?.pipe(
              tap((v) => {
                testValue = v
              })
            ),
          [value]
        )

        useEffect(() => {
          setTimeout(() => {
            setValue(of(5))
          }, 10)
        }, [])
      }, {})

      await waitForTimeout(20)

      expect(testValue).toBe(5)
    })
  })
})
