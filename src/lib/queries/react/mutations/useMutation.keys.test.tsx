import { afterEach, describe, expect, it } from "vitest"
import { render, cleanup } from "@testing-library/react"
import React, { useEffect } from "react"
import { useMutation } from "./useMutation"
import { QueryClientProvider } from "../Provider"
import { QueryClient } from "../../client/createClient"

afterEach(() => {
  cleanup()
})

describe("useMutation", () => {
  describe("Given two mutations without keys", () => {
    describe("when first mutation has result", () => {
      it("should not change the result of second mutation", async () => {
        const client = new QueryClient()
        const values = { mutation: [] as any, observedMutation: [] as any }

        const Comp = () => {
          const mutation = useMutation({
            mutationFn: async () => 2
          })

          const observedMutation = useMutation({
            mutationFn: async () => {}
          })

          useEffect(() => {
            values.mutation.push(mutation)
            values.observedMutation.push(observedMutation)
          }, [observedMutation, mutation])

          useEffect(() => {
            mutation.mutate()
          }, [])

          // we only display content once all queries are done
          // this way when we text string later we know exactly
          return <>{mutation.data}</>
        }

        const { findByText } = render(
          <React.StrictMode>
            <QueryClientProvider client={client}>
              <Comp />
            </QueryClientProvider>
          </React.StrictMode>
        )

        expect(await findByText("2")).toBeDefined()

        const expectedValue = [
          {
            data: undefined,
            status: "idle"
          },
          {
            data: undefined,
            status: "idle"
          },
          {
            data: undefined,
            status: "pending"
          },
          {
            data: 2,
            status: "success"
          }
        ]

        expectedValue.forEach((value, index) => {
          expect(values.mutation[index]).toContain(value)
        })

        expect(values.observedMutation).toMatchObject(
          Array.from({ length: 4 }).map(() => ({
            data: undefined,
            status: "idle"
          }))
        )
      })
    })
  })
})
