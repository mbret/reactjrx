import { describe, expect, it } from "vitest"
import { render, waitFor } from "@testing-library/react"
import * as React from "react"
import { useMutation } from "./useMutation"
import { useIsMutating } from "./useMutationState"
import {
  createQueryClient,
  renderWithClient,
  setActTimeout,
  sleep
} from "../../../../tests/utils"
import { delay, of } from "rxjs"

describe("useIsMutating", () => {
  it("should return the number of fetching mutations", async () => {
    const isMutatings: number[] = []
    const queryClient = createQueryClient()

    function IsMutating() {
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const isMutating = useIsMutating()
      isMutatings.push(isMutating)
      return null
    }

    function Mutations() {
      const { mutate: mutate1 } = useMutation({
        mutationKey: ["mutation1"],
        mutationFn: async () => {
          await sleep(150)
          return "data"
        }
      })
      const { mutate: mutate2 } = useMutation({
        mutationKey: ["mutation2"],
        mutationFn: async () => {
          await sleep(50)
          return "data"
        }
      })

      React.useEffect(() => {
        mutate1()
        setActTimeout(() => {
          mutate2()
        }, 50)
      }, [mutate1, mutate2])

      return null
    }

    function Page() {
      return (
        <div>
          <IsMutating />
          <Mutations />
        </div>
      )
    }

    renderWithClient(queryClient, <Page />)
    await waitFor(() => {
      expect(isMutatings).toEqual([0, 1, 2, 1, 0])
    }, {})
  })

  it("should return the number of fetching observables mutations", async () => {
    const isMutatings: number[] = []
    const queryClient = createQueryClient()

    const mutation2 = of("data").pipe(delay(50))

    function IsMutating() {
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const isMutating = useIsMutating()
      isMutatings.push(isMutating)
      return null
    }

    function Mutations() {
      const { mutate: mutate1 } = useMutation({
        mutationKey: ["mutation1"],
        mutationFn: () => of("data").pipe(delay(150))
      })
      const { mutate: mutate2 } = useMutation({
        mutationKey: ["mutation2"],
        mutationFn: mutation2
      })

      React.useEffect(() => {
        mutate1()
        setActTimeout(() => {
          mutate2()
        }, 50)
      }, [mutate1, mutate2])

      return null
    }

    function Page() {
      return (
        <div>
          <IsMutating />
          <Mutations />
        </div>
      )
    }

    renderWithClient(queryClient, <Page />)
    await waitFor(() => {
      expect(isMutatings).toEqual([0, 1, 2, 1, 0])
    }, {})
  })

  it("should filter correctly by mutationKey", async () => {
    const isMutatings: number[] = []
    const queryClient = createQueryClient()

    // @todo make test works without memo
    const IsMutating = React.memo(() => {
      const isMutating = useIsMutating({ mutationKey: ["mutation1"] })

      isMutatings.push(isMutating)

      return null
    })

    function Page() {
      const { mutate: mutate1 } = useMutation({
        mutationKey: ["mutation1"],
        mutationFn: async () => {
          await sleep(100)
          return "data"
        }
      })
      const { mutate: mutate2 } = useMutation({
        mutationKey: ["mutation2"],
        mutationFn: async () => {
          await sleep(100)
          return "data"
        }
      })

      React.useEffect(() => {
        mutate1()
        mutate2()
      }, [mutate1])

      return <IsMutating />
    }

    renderWithClient(queryClient, <Page />)

    await waitFor(() => {
      expect(isMutatings).toEqual([0, 1, 0])
    })
  })

  it("should filter correctly by predicate", async () => {
    const isMutatings: number[] = []
    const queryClient = createQueryClient()

    // @todo make test works without memo
    const IsMutating = React.memo(() => {
      const isMutating = useIsMutating({
        predicate: (mutation) =>
          mutation.options.mutationKey?.[0] === "mutation1"
      })
      isMutatings.push(isMutating)

      return null
    })

    function Page() {
      const { mutate: mutate1 } = useMutation({
        mutationKey: ["mutation1"],
        mutationFn: async () => {
          await sleep(100)
          return "data"
        }
      })
      const { mutate: mutate2 } = useMutation({
        mutationKey: ["mutation2"],
        mutationFn: async () => {
          await sleep(100)
          return "data"
        }
      })

      React.useEffect(() => {
        mutate1()
        mutate2()
      }, [mutate1, mutate2])

      return <IsMutating />
    }

    renderWithClient(queryClient, <Page />)
    await waitFor(() => {
      expect(isMutatings).toEqual([0, 1, 0])
    })
  })

  it("should use provided custom queryClient", async () => {
    const queryClient = createQueryClient()

    function Page() {
      const isMutating = useIsMutating({}, queryClient)
      const { mutate } = useMutation(
        {
          mutationKey: ["mutation1"],
          mutationFn: async () => {
            await sleep(10)
            return "data"
          }
        },
        queryClient
      )

      React.useEffect(() => {
        mutate()
      }, [mutate])

      return (
        <div>
          <div>mutating: {isMutating}</div>
        </div>
      )
    }

    const rendered = render(<Page></Page>)

    await waitFor(() => rendered.getByText("mutating: 1"))
  })
})
