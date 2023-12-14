import { describe, expect, it } from "vitest"
import { QueryClient } from "../../client/createClient"
import { StrictMode, useEffect, useState } from "react"
import { useMutation } from "./useMutation"
import { QueryClientProvider } from "../Provider"
import { render } from "@testing-library/react"
import { NEVER, finalize, timer } from "rxjs"
import { waitForTimeout } from "../../../../tests/utils"

describe("Given two mutation watching the same key", () => {
  describe("and when one mutation is just observer and unmount", () => {
    it("should not cancel the mutation foobar", async () => {
      const client = new QueryClient()
      let finalized = 0

      const WatchingMutation = () => {
        useMutation({
          cancelOnUnMount: true,
          mutationKey: ["foo"],
          mutationFn: async () => 2
        })

        return null
      }

      const Comp = () => {
        const [hidden, setHidden] = useState(false)
        const { mutate } = useMutation({
          mutationKey: ["foo"],
          mutationFn: () =>
            timer(100).pipe(
              finalize(() => {
                finalized++
              })
            )
        })

        useEffect(() => {
          mutate()

          setTimeout(() => {
            setHidden(true)
          }, 10)
        }, [mutate])

        // we only display content once all queries are done
        // this way when we text string later we know exactly
        return <>{hidden ? "hidden" : <WatchingMutation />}</>
      }

      const { findByText } = render(
        //   <StrictMode>
        <QueryClientProvider client={client}>
          <Comp />
        </QueryClientProvider>
        //   </StrictMode>
      )

      expect(await findByText("hidden")).toBeDefined()

      expect(finalized).toBe(0)

      client.mutationClient.cancel({ key: ["foo"] })

      expect(finalized).toBe(1)
    })
  })
})
