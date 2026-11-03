import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react"
import React, { useEffect } from "react"
import { finalize, ReplaySubject, Subject, takeUntil, timer } from "rxjs"
import { afterEach, describe, expect, it } from "vitest"
import { createWrapper } from "../../tests/liveQuery"
import { waitForTimeout } from "../../tests/utils"
import { useMutation$ } from "./useMutation$"

afterEach(() => {
  cleanup()
})

describe("useMutation", () => {
  describe("Given component unmount", () => {
    describe("when there is an active query occurring", () => {
      /**
       * @disclaimer
       * I could not find a way to test the completeness of the inner observable without "cheating"
       * by adding a hook. It's anti pattern but will do it until I find better way
       */
      it("should complete main observable chain when mutation finish", async () => {
        let finalized = 0
        let unmountTime = 0
        const manualStop = new ReplaySubject<void>()

        const client = new QueryClient()

        const Comp = () => {
          const { mutate } = useMutation$({
            mutationFn: () =>
              timer(1000).pipe(
                takeUntil(manualStop),
                finalize(() => {
                  finalized++
                }),
              ),
          })

          useEffect(() => {
            mutate()

            return () => {
              unmountTime++
            }
          }, [mutate])

          return null
        }

        const { unmount } = render(
          <React.StrictMode>
            <QueryClientProvider client={client}>
              <Comp />
            </QueryClientProvider>
          </React.StrictMode>,
        )

        unmount()

        // observable should not be forcefully closed
        expect(finalized).toBe(0)

        // we simulate a long observable to stop after a while
        manualStop.next()

        await waitForTimeout(10)

        expect(finalized).toBe(unmountTime)
      })
    })
  })

  describe("Given mutations that share a scope", () => {
    it("should start each one once the previous one has failed or emitted", async () => {
      const sources = {
        first: new Subject<string>(),
        second: new Subject<string>(),
        third: new Subject<string>(),
      }
      const failure = new Error("first failed")
      const started: string[] = []

      const { result } = renderHook(
        () =>
          useMutation$({
            scope: { id: "save" },
            mutationFn: (name: keyof typeof sources) => {
              started.push(name)

              return sources[name]
            },
          }),
        { wrapper: createWrapper(new QueryClient()) },
      )

      let settled!: Promise<PromiseSettledResult<string>[]>

      act(() => {
        settled = Promise.allSettled([
          result.current.mutateAsync("first"),
          result.current.mutateAsync("second"),
          result.current.mutateAsync("third"),
        ])
      })

      await waitFor(() => expect(started).toEqual(["first"]))

      act(() => sources.first.error(failure))

      await waitFor(() => expect(started).toEqual(["first", "second"]))

      act(() => sources.second.next("second saved"))

      await waitFor(() => expect(started).toEqual(["first", "second", "third"]))

      act(() => sources.third.next("third saved"))

      expect(await settled).toEqual([
        { status: "rejected", reason: failure },
        { status: "fulfilled", value: "second saved" },
        { status: "fulfilled", value: "third saved" },
      ])
    })
  })
})
