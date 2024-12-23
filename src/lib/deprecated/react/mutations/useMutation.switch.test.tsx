import { afterEach, describe, expect, it, vi } from "vitest"
import { finalize, timer, map } from "rxjs"
import { render, cleanup, waitFor } from "@testing-library/react"
import React, { useEffect } from "react"
import { useMutation } from "./useMutation"
import { QueryClientProvider } from "../QueryClientProvider"
import { QueryClient } from "../../client/QueryClient"
import { waitForTimeout } from "../../../../tests/utils"

afterEach(() => {
  cleanup()
})

describe("useMutation", () => {
  describe("Given switch operator", () => {
    describe("and consecutive promises", () => {
      it("should cancel every but last one", async () => {
        const client = new QueryClient()
        const onCallbackMutation = vi.fn()

        const Comp = () => {
          const { mutate } = useMutation({
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            mutationFn: async (_: number) => {
              await waitForTimeout(10)
            },
            mapOperator: "switch",
            onSuccess: onCallbackMutation,
            onSettled: onCallbackMutation,
            onError: onCallbackMutation
          })

          useEffect(() => {
            mutate(0)
            mutate(1)
          }, [mutate])

          // we only display content once all queries are done
          // this way when we text string later we know exactly
          return <></>
        }

        render(
          <React.StrictMode>
            <QueryClientProvider client={client}>
              <Comp />
            </QueryClientProvider>
          </React.StrictMode>
        )

        await waitFor(() => {
          expect(onCallbackMutation).toHaveBeenCalledTimes(2)
        })

        await waitForTimeout(30)

        expect(onCallbackMutation).toHaveBeenCalledTimes(2)
        expect(onCallbackMutation.mock.calls).toEqual([
          [undefined, 1, undefined],
          [undefined, null, 1, undefined]
        ])
      })
    })

    describe("and consecutive observables", () => {
      it("should cancel every but last one", async () => {
        const client = new QueryClient()
        const onCallbackMutation = vi.fn()
        const finalizeFn = vi.fn()

        const Comp = () => {
          const { mutate } = useMutation({
            mutationFn: () =>
              timer(10).pipe(
                map(() => undefined),
                finalize(finalizeFn)
              ),
            mapOperator: "switch",
            onSuccess: onCallbackMutation,
            onSettled: onCallbackMutation,
            onError: onCallbackMutation
          })

          useEffect(() => {
            mutate(0)
            mutate(1)
            mutate(2)
          }, [mutate])

          // we only display content once all queries are done
          // this way when we text string later we know exactly
          return <></>
        }

        render(
          <React.StrictMode>
            <QueryClientProvider client={client}>
              <Comp />
            </QueryClientProvider>
          </React.StrictMode>
        )

        await waitFor(() => {
          expect(onCallbackMutation).toHaveBeenCalledTimes(2)
        })

        await waitForTimeout(30)

        // we account for strict mode
        expect(finalizeFn).toHaveBeenCalledTimes(4 + 2)
        expect(onCallbackMutation).toHaveBeenCalledTimes(2)
        expect(onCallbackMutation.mock.calls).toEqual([
          [undefined, 2, undefined],
          [undefined, null, 2, undefined]
        ])
      })
    })
  })
})
