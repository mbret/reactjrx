import { describe, expect, it, vi } from "vitest"
import { lastValueFrom, of } from "rxjs"
import { createClient } from "../createClient"
import { serializeKey } from "./serializeKey"

describe("keys", () => {
  describe("Given a query without key", () => {
    describe("and cache and stale are infinite", () => {
      it("should call again the new fn", async () => {
        const client = createClient()
        const fnMock = vi.fn().mockImplementation(() => of(10))

        await lastValueFrom(
          client.query$({
            key: [],
            fn: fnMock,
            options$: of({
              cacheTime: Infinity,
              staleTime: Infinity,
              terminateOnFirstResult: true
            })
          }).result$
        )

        expect(fnMock.mock.calls.length).toBe(1)

        await lastValueFrom(
          client.query$({
            key: [],
            fn: fnMock,
            options$: of({
              cacheTime: Infinity,
              staleTime: Infinity,
              terminateOnFirstResult: true
            })
          }).result$
        )

        expect(fnMock.mock.calls.length).toBe(2)
      })
    })

    it("should not be registered in the store", async () => {
      const client = createClient()
      const fnMock = vi.fn().mockImplementation(() => of(10))

      await lastValueFrom(
        client.query$({
          key: [],
          fn: fnMock,
          options$: of({
            cacheTime: Infinity,
            staleTime: Infinity,
            terminateOnFirstResult: true
          })
        }).result$
      )

      expect(client.queryStore.get(serializeKey([]))).toBeUndefined()
    })
  })
})
