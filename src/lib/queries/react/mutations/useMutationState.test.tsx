import { describe, expect, expectTypeOf, it } from "vitest"
import { fireEvent, waitFor } from "@testing-library/react"
import type { MutationStatus } from "@tanstack/query-core"
import { useMutationState } from "./useMutationState"
import {
  createQueryClient,
  doNotExecute,
  renderWithClient,
  sleep
} from "../../../../tests/utils"
import { useMutation } from "./useMutation"
import { MutationState } from "../../client/mutations/types"

describe("useMutationState", () => {
  describe("types", () => {
    it("should default to QueryState", () => {
      doNotExecute(() => {
        const result = useMutationState({
          filters: { status: "pending" }
        })

        expectTypeOf(result).toEqualTypeOf<MutationState[]>()
      })
    })

    it("should infer with select", () => {
      doNotExecute(() => {
        const result = useMutationState({
          filters: { status: "pending" },
          select: (mutation) => mutation.state.status
        })

        expectTypeOf(result).toEqualTypeOf<MutationStatus[]>()
      })
    })
  })
  // it('should return variables after calling mutate', async () => {
  //   const queryClient = createQueryClient()
  //   const variables: unknown[][] = []
  //   const mutationKey = ['mutation']

  //   function Variables() {
  //     variables.push(
  //       useMutationState({
  //         filters: { mutationKey, status: 'pending' },
  //         select: (mutation) => mutation.state.variables,
  //       }),
  //     )

  //     return null
  //   }

  //   function Mutate() {
  //     const { mutate, data } = useMutation({
  //       mutationKey,
  //       mutationFn: async (input: number) => {
  //         await sleep(150)
  //         return 'data' + input
  //       },
  //     })

  //     return (
  //       <div>
  //         data: {data ?? 'null'}
  //         <button onClick={() => mutate(1)}>mutate</button>
  //       </div>
  //     )
  //   }

  //   function Page() {
  //     return (
  //       <div>
  //         <Variables />
  //         <Mutate />
  //       </div>
  //     )
  //   }

  //   const rendered = renderWithClient(queryClient, <Page />)

  //   await waitFor(() => rendered.getByText('data: null'))

  //   fireEvent.click(rendered.getByRole('button', { name: /mutate/i }))

  //   await waitFor(() => rendered.getByText('data: data1'))

  //   expect(variables).toEqual([[], [1], []])
  // })
})
