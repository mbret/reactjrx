import { describe, expect, it } from "vitest"
import { filter, firstValueFrom, of, tap } from "rxjs"
import { createClient } from "../createClient"
import { serializeKey } from "../keys/serializeKey"
import { waitForTimeout } from "../../../../tests/utils"

describe("cache", () => {
  describe("Given a query", () => {
    describe("and a cache time of 0", () => {
      it("should not have value in cache", async () => {
        const client = createClient()
        const serializedKey = serializeKey(["foo"])

        await firstValueFrom(
          client
            .query$({
              key: ["foo"],
              fn: () => of(2),
              options$: of({
                cacheTime: 0
              })
            })
            .result$.pipe(
              filter((result) => !!result.data),
              tap(() => {
                expect(
                  client.queryStore.get(serializedKey)?.cache_fnResult
                ).toBeUndefined()
              })
            )
        )
      })

      it("it should remove the query from the store once the query is done", async () => {
        const client = createClient()
        const serializedKey = serializeKey(["foo"])

        await firstValueFrom(
          client
            .query$({
              key: ["foo"],
              fn: () => of(2),
              options$: of({
                cacheTime: 0
              })
            })
            .result$.pipe(filter((result) => !!result.data))
        )

        expect(client.queryStore.get(serializedKey)).toBeUndefined()
      })
    })

    describe("and a cache time of infinity", () => {
      it("should have value in cache", async () => {
        const client = createClient()
        const serializedKey = serializeKey(["foo"])

        await firstValueFrom(
          client
            .query$({
              key: ["foo"],
              fn: () => of(2),
              options$: of({
                cacheTime: Infinity
              })
            })
            .result$.pipe(
              filter((result) => !!result.data),
              tap(() => {
                expect(
                  client.queryStore.get(serializedKey)?.cache_fnResult
                ).toEqual({ result: 2 })
              })
            )
        )
      })

      it("it should not remove the query from the store once the query is done", async () => {
        const client = createClient()
        const serializedKey = serializeKey(["foo"])

        await firstValueFrom(
          client
            .query$({
              key: ["foo"],
              fn: () => of(2),
              options$: of({
                cacheTime: Infinity
              })
            })
            .result$.pipe(filter((result) => !!result.data))
        )

        expect(client.queryStore.get(serializedKey)).toBeDefined()
      })
    })

    describe("and a cache time of several ms", () => {
      it("should have value in cache", async () => {
        const client = createClient()
        const serializedKey = serializeKey(["foo"])

        await firstValueFrom(
          client
            .query$({
              key: ["foo"],
              fn: () => of(2),
              options$: of({
                cacheTime: 100
              })
            })
            .result$.pipe(
              filter((result) => !!result.data),
              tap(() => {
                expect(
                  client.queryStore.get(serializedKey)?.cache_fnResult
                ).toEqual({ result: 2 })
              })
            )
        )
      })

      it("it should remove the query shortly after the cache expire", async () => {
        const client = createClient()
        const serializedKey = serializeKey(["foo"])

        await firstValueFrom(
          client
            .query$({
              key: ["foo"],
              fn: () => of(2),
              options$: of({
                cacheTime: 5
              })
            })
            .result$.pipe(filter((result) => !!result.data))
        )

        expect(client.queryStore.get(serializedKey)).toBeDefined()

        await waitForTimeout(5)

        expect(client.queryStore.get(serializedKey)).toBeUndefined()
      })
    })
  })
})
