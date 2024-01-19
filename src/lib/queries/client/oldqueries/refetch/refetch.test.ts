import { describe, expect, it } from "vitest"
import { Subject, lastValueFrom, scan, take, takeWhile, tap } from "rxjs"
import { type QueryResult, type QueryTrigger } from "../../types"
import { QueryClient } from "../../QueryClient"

describe("refetch", () => {
  describe("Given two queries with same key", () => {
    describe("and we refetch query a on first success", () => {
      it("should refetch the second query as well", async () => {
        const client = new QueryClient().getQueryCache().client
        const trigger$ = new Subject<QueryTrigger>()
        let hasRefetch = false
        let result = 0

        client.start()

        const fn = async () => {
          result++

          return result
        }

        const [resA, resB] = await Promise.all([
          lastValueFrom(
            client
              .query({
                key: ["foo"],
                fn,
                trigger$
              })
              .result$.pipe(
                tap((result) => {
                  if (result.data?.result === 1 && !hasRefetch) {
                    hasRefetch = true
                    trigger$.next({ ignoreStale: true, type: "refetch" })
                  }
                }),
                takeWhile((result) => result.data?.result !== 2, true),
                scan(
                  (acc: Array<QueryResult<number>>, value) => [...acc, value],
                  []
                )
              )
          ),
          lastValueFrom(
            client
              .query({
                key: ["foo"],
                fn
              })
              .result$.pipe(
                take(4),
                scan(
                  (acc: Array<QueryResult<number>>, value) => [...acc, value],
                  []
                )
              )
          )
        ])

        expect(resA[0]).toMatchObject({
          data: undefined,
          status: "loading",
          fetchStatus: "fetching"
        })
        expect(resA[1]).toMatchObject({
          data: { result: 1 },
          status: "success",
          fetchStatus: "fetching"
        })
        expect(resA[2]).toMatchObject({
          data: { result: 2 },
          status: "success",
          fetchStatus: "fetching"
        })

        expect(resB[0]).toMatchObject({
          data: undefined,
          status: "loading",
          fetchStatus: "fetching"
        })
        expect(resB[1]).toMatchObject({
          data: { result: 1 },
          status: "success",
          fetchStatus: "fetching"
        })
        expect(resB[2]).toMatchObject({
          data: { result: 2 },
          status: "success",
          fetchStatus: "fetching"
        })
        expect(resB[3]).toMatchObject({
          data: { result: 2 },
          status: "success",
          fetchStatus: "idle"
        })
      })
    })

    describe("and we refetch query with same key from client", () => {
      it("should refetch the second query as well", async () => {
        const client = new QueryClient().getQueryCache().client
        const trigger$ = new Subject<QueryTrigger>()
        let hasRefetch = false
        let result = 0

        client.start()

        const fn = async () => {
          result++

          return result
        }

        const [resA, resB] = await Promise.all([
          lastValueFrom(
            client
              .query({
                key: ["foo"],
                fn,
                trigger$
              })
              .result$.pipe(
                tap((result) => {
                  if (result.data?.result === 1 && !hasRefetch) {
                    hasRefetch = true
                    client.invalidateQueries({ queryKey: ["foo"] })
                  }
                }),
                takeWhile((result) => result.data?.result !== 2, true),
                scan(
                  (acc: Array<QueryResult<number>>, value) => [...acc, value],
                  []
                )
              )
          ),
          lastValueFrom(
            client
              .query({
                key: ["foo"],
                fn
              })
              .result$.pipe(
                take(4),
                scan(
                  (acc: Array<QueryResult<number>>, value) => [...acc, value],
                  []
                )
              )
          )
        ])

        expect(resA[0]).toMatchObject({
          data: undefined,
          status: "loading",
          fetchStatus: "fetching"
        })
        expect(resA[1]).toMatchObject({
          data: { result: 1 },
          status: "success",
          fetchStatus: "fetching"
        })
        expect(resA[2]).toMatchObject({
          data: { result: 2 },
          status: "success",
          fetchStatus: "fetching"
        })

        expect(resB[0]).toMatchObject({
          data: undefined,
          status: "loading",
          fetchStatus: "fetching"
        })
        expect(resB[1]).toMatchObject({
          data: { result: 1 },
          status: "success",
          fetchStatus: "fetching"
        })
        expect(resB[2]).toMatchObject({
          data: { result: 2 },
          status: "success",
          fetchStatus: "fetching"
        })
        expect(resB[3]).toMatchObject({
          data: { result: 2 },
          status: "success",
          fetchStatus: "idle"
        })
      })
    })
  })
})
