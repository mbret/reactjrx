import { describe, expect, it, vi } from "vitest"
import { BehaviorSubject, Subject, of } from "rxjs"
import { createClient } from "../createClient"
import { waitForTimeout } from "../../../../tests/utils"

describe("invalidation", () => {
  describe("Given an observable that does not emit yet", () => {
    describe("and a cache and stale of 0", () => {
      it("should only call the function once", async () => {
        const client = createClient()

        const deferredResult$ = new Subject()
        const queryMock = vi.fn().mockImplementation(() => deferredResult$)

        client
          .query$({
            key: ["foo"],
            fn$: of(queryMock),
            options$: of({
              cacheTime: 0,
              staleTime: 0
            })
          })
          .result$.subscribe()

        expect(queryMock).toHaveBeenCalledTimes(1)

        client
          .query$({
            key: ["foo"],
            fn$: of(queryMock)
          })
          .result$.subscribe()

        expect(queryMock).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("and cache already exists", () => {
    it("should call the function only once", async () => {
      const client = createClient()

      const deferredResult$ = new Subject<number>()
      const queryMock = vi.fn().mockImplementation(() => deferredResult$)

      client
        .query$({
          key: ["foo"],
          fn$: of(queryMock),
          options$: of({
            staleTime: Infinity
          })
        })
        .result$.subscribe()

      expect(queryMock).toHaveBeenCalledTimes(1)

      deferredResult$.next(2)
      deferredResult$.complete()

      client
        .query$({
          key: ["foo"],
          fn$: of(queryMock),
          options$: of({
            staleTime: Infinity
          })
        })
        .result$.subscribe()

      expect(queryMock).toHaveBeenCalledTimes(1)
    })
  })

  describe("and cache does not exists", () => {
    it("should call the function twice", async () => {
      const client = createClient()

      const deferredResult$ = new Subject<number>()
      const deferredResult2$ = new Subject<number>()
      const queryMock = vi.fn().mockImplementation(() => {
        console.log("CALL")

        return deferredResult$
      })
      const query$ = new BehaviorSubject(queryMock)

      client
        .query$({
          key: ["foo"],
          fn$: query$,
          options$: of({
            staleTime: 9999,
            cacheTime: 0
          })
        })
        .result$.subscribe({
          error: console.error
        })

      expect(queryMock).toHaveBeenCalledTimes(1)

      deferredResult$.next(2)
      deferredResult$.complete()

      queryMock.mockResolvedValue(deferredResult2$)

      client
        .query$({
          key: ["foo"],
          fn$: query$,
          options$: of({
            staleTime: 9999
          })
        })
        .result$.subscribe({ error: console.error })

      expect(queryMock).toHaveBeenCalledTimes(2)

      await waitForTimeout(100)
    })
  })
})