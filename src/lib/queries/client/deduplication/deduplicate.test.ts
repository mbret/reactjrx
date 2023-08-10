import {
  BehaviorSubject,
  defer,
  from,
  lastValueFrom,
  of,
  repeat,
  tap
} from "rxjs"
import { expect, it, describe } from "vitest"
import { deduplicate } from "./deduplicate"
import { serializeKey } from "../keys/serializeKey"
import { createClient } from "../createClient"
import { type QueryOptions } from "../types"

describe("deduplicate tests", () => {
  describe("Given a repeat operator after deduplicate", () => {
    it("should repeat the original query and not break the stream chain", async () => {
      let value = 0

      const query = async () => {
        value++
      }

      const queryStore = new Map()

      await lastValueFrom(
        defer(() => {
          return from(query())
        }).pipe(
          deduplicate(serializeKey(["foo"]), queryStore),
          repeat({
            count: 2
          })
        )
      )

      expect(value).toBe(2)
    })
  })

  describe("Given a non async query", () => {
    describe("and two calls at the same time", () => {
      it("should run the query two times", async () => {
        let value = 0

        const query = () => {
          value++
        }

        const deferredQuery$ = defer(() => of(null).pipe(tap(query)))

        const queryStore = new Map()

        await Promise.all([
          lastValueFrom(
            deferredQuery$.pipe(deduplicate(serializeKey(["foo"]), queryStore))
          ),
          lastValueFrom(
            deferredQuery$.pipe(deduplicate(serializeKey(["foo"]), queryStore))
          )
        ])

        expect(value).toBe(2)
      })
    })
  })

  describe("Given an async query", () => {
    describe("and two calls at the same time", () => {
      describe("and the same key", () => {
        it("should run the query only once", async () => {
          let value = 0

          const query = async () => {
            value++
          }

          const deferredQuery$ = defer(() => from(query()))

          const queryStore = new Map()

          await Promise.all([
            lastValueFrom(
              deferredQuery$.pipe(
                deduplicate(serializeKey(["foo"]), queryStore)
              )
            ),
            lastValueFrom(
              deferredQuery$.pipe(
                deduplicate(serializeKey(["foo"]), queryStore)
              )
            )
          ])

          expect(value).toBe(1)
        })

        describe("and using client", () => {
          it("should run the query only once", async () => {
            let value = 0

            const query = async () => {
              value++
            }

            const query$ = new BehaviorSubject(query)
            const options$ = new BehaviorSubject<QueryOptions>({
              terminateOnFirstResult: true
            })
            const client = createClient()

            await Promise.all([
              lastValueFrom(
                client.query$({ key: ["foo"], fn$: query$, options$ }).result$
              ),
              lastValueFrom(
                client.query$({ key: ["foo"], fn$: query$, options$ }).result$
              )
            ])

            expect(value).toBe(1)
          })
        })
      })
    })
  })
})
