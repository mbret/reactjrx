import { describe, expect, it } from "vitest"
import {
  Subject,
  filter,
  lastValueFrom,
  merge,
  of,
  shareReplay,
  take,
  tap
} from "rxjs"
import { QueryClient } from "../createClient"
import { serializeKey } from "../keys/serializeKey"
import { getInitialQueryEntity } from "../store/initializeQueryInStore"

describe("cacheClient", () => {
  describe("setQueryData()", () => {
    describe("Given a query key: []", () => {
      it("should not register the new query", async () => {
        const client = new QueryClient().client

        client.start()

        client.setQueryData({
          queryKey: [],
          updater: 2
        })

        expect(client.queryStore.get(serializeKey([]))).toBeUndefined()
      })
    })

    describe(`Given a query key: ["foo"]`, () => {
      describe("and the query does not exist yet", () => {
        it("should register the new query and its result", async () => {
          const client = new QueryClient().client

          client.start()

          client.setQueryData({
            queryKey: ["foo"],
            updater: 2
          })

          expect(client.queryStore.get(serializeKey(["foo"]))).toEqual({
            ...getInitialQueryEntity({ key: ["foo"] }),
            cache_fnResult: {
              result: 2
            }
          })
        })
      })

      describe("and the query already exist", () => {
        it("should register the new query and its result", async () => {
          const client = new QueryClient().client

          client.start()

          await lastValueFrom(
            client.query({
              key: ["foo"],
              fn: async () => 2,
              options$: of({
                terminateOnFirstResult: true
              })
            }).result$
          )

          expect(client.queryStore.get(serializeKey(["foo"]))).toBeDefined()

          client.setQueryData({
            queryKey: ["foo"],
            updater: 3
          })

          expect(
            client.queryStore.get(serializeKey(["foo"]))?.cache_fnResult
          ).toEqual({
            result: 3
          })
        })
      })

      it("should register the new query and its result", async () => {
        const client = new QueryClient().client

        client.start()

        await lastValueFrom(
          client.query({
            key: ["foo"],
            fn: async () => 2,
            options$: of({
              terminateOnFirstResult: true
            })
          }).result$
        )

        expect(client.queryStore.get(serializeKey(["foo"]))).toBeDefined()

        client.setQueryData({
          queryKey: ["foo"],
          updater: 3
        })

        expect(
          client.queryStore.get(serializeKey(["foo"]))?.cache_fnResult
        ).toEqual({
          result: 3
        })
      })
    })

    describe("Given the method being called with a result", () => {
      describe("and we call query with same key right after", () => {
        it("should return the same result without calling the fn", async () => {
          const client = new QueryClient().client

          client.start()

          client.setQueryData({
            queryKey: ["foo"],
            updater: 3
          })

          await lastValueFrom(
            client.query({
              key: ["foo"],
              fn: async () => 2,
              options$: of({
                terminateOnFirstResult: true
              })
            }).result$
          )

          expect(
            client.queryStore.get(serializeKey(["foo"]))?.cache_fnResult
          ).toEqual({
            result: 3
          })
        })
      })
    })

    describe("Given a query", () => {
      describe("and we setQueryData onSuccess of said query", () => {
        it("should return the result of cached data and not the query", async () => {
          const client = new QueryClient().client
          const results: any[] = []
          let alreadyMade = false

          client.start()

          await lastValueFrom(
            client
              .query({
                key: ["foo"],
                fn: async () => 2,
                options$: of({
                  staleTime: Infinity,
                  onSuccess: () => {
                    if (alreadyMade) return

                    alreadyMade = true

                    client.setQueryData({
                      queryKey: ["foo"],
                      updater: 3
                    })
                  }
                })
              })
              .result$.pipe(
                tap((result) => results.push(result)),
                take(4)
              )
          )

          expect(results[0]).toMatchObject({
            data: undefined,
            status: "loading",
            fetchStatus: "fetching"
          })
          expect(results[1]).toMatchObject({
            data: { result: 2 },
            status: "success",
            fetchStatus: "fetching"
          })
          expect(results[2]).toMatchObject({
            data: { result: 2 },
            status: "success",
            fetchStatus: "idle"
          })
          expect(results[3]).toMatchObject({
            data: { result: 3 },
            status: "success",
            fetchStatus: "idle"
          })
        })
      })

      describe("which takes time and we call setQueryData before we have a result", () => {
        it("should return the query cache first and then the query result", async () => {
          const client = new QueryClient().client
          const results: any[] = []
          const deferredResult = new Subject<number>()

          client.start()

          const query$ = client
            .query({
              key: ["foo"],
              fn: () => deferredResult,
              options$: of({})
            })
            .result$.pipe(
              shareReplay({
                refCount: true
              })
            )

          await lastValueFrom(
            merge(
              query$.pipe(
                tap((result) => {
                  results.push(result)
                }),
                take(4)
              ),
              query$.pipe(
                take(1),
                tap((result) => {
                  expect(result).toMatchObject({
                    data: undefined,
                    status: "loading",
                    fetchStatus: "fetching"
                  })

                  client.setQueryData({
                    queryKey: ["foo"],
                    updater: 3
                  })
                }),
                filter(() => false)
              ),
              query$.pipe(
                filter((value) => value.data?.result === 3),
                take(1),
                tap((result) => {
                  expect(result).toMatchObject({
                    data: { result: 3 },
                    status: "success",
                    fetchStatus: "fetching"
                  })

                  deferredResult.next(2)
                  deferredResult.complete()
                }),
                filter(() => false)
              )
            )
          )

          expect(results[0]).toMatchObject({
            data: undefined,
            status: "loading",
            fetchStatus: "fetching"
          })
          expect(results[1]).toMatchObject({
            data: { result: 3 },
            status: "success",
            fetchStatus: "fetching"
          })
          expect(results[2]).toMatchObject({
            data: { result: 2 },
            status: "success",
            fetchStatus: "fetching" // @todo remove that state
          })
          expect(results[3]).toMatchObject({
            data: { result: 2 },
            status: "success",
            fetchStatus: "idle"
          })
        })
      })
    })
  })
})
