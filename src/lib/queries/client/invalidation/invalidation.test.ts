import { describe, expect, it, vi } from "vitest"
import { BehaviorSubject, Subject, of } from "rxjs"
import { QueryClient } from "../createClient"
import { waitForTimeout } from "../../../../tests/utils"

describe("invalidation", () => {
  describe("Given an observable that does not emit yet", () => {
    describe("and a cache and stale of 0", () => {
      it("should only call the function once", async () => {
        const client = new QueryClient().client

        const deferredResult$ = new Subject()
        const queryMock = vi.fn().mockImplementation(() => deferredResult$)

        client.start()

        client
          .query({
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
          .query({
            key: ["foo"],
            fn$: of(queryMock)
          })
          .result$.subscribe()

        expect(queryMock).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("Given a query that is in the cache", () => {
    describe("and the query fn is called again", () => {
      it("should call the function only once", async () => {
        const client = new QueryClient().client
        const deferredResult$ = new Subject<number>()
        const queryMock = vi.fn().mockImplementation(() => deferredResult$)

        client.start()

        client
          .query({
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

        await waitForTimeout(200)

        client
          .query({
            key: ["foo"],
            fn$: of(queryMock),
            options$: of({
              staleTime: Infinity
            })
          })
          .result$.subscribe()

        expect(queryMock).toHaveBeenCalledTimes(1)
      })

      describe("and new query is marked as stale", () => {
        it("should call the fn again", async () => {
          const client = new QueryClient().client
          const deferredResult$ = new Subject<number>()
          const queryMock = vi.fn().mockImplementation(() => deferredResult$)

          client.start()

          client
            .query({
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
          queryMock.mockResolvedValue(new Subject())

          client
            .query({
              key: ["foo"],
              fn$: of(queryMock),
              options$: of({
                staleTime: Infinity,
                markStale: true
              })
            })
            .result$.subscribe()

          expect(queryMock).toHaveBeenCalledTimes(2)
        })
      })
    })
  })

  describe("and cache does not exists", () => {
    it("should call the function twice", async () => {
      const client = new QueryClient().client

      const deferredResult$ = new Subject<number>()
      const deferredResult2$ = new Subject<number>()
      const queryMock = vi.fn().mockImplementation(() => {
        return deferredResult$
      })
      const query$ = new BehaviorSubject(queryMock)

      client.start()

      client
        .query({
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
        .query({
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
