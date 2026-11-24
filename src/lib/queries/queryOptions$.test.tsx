import { act, render, screen, waitFor } from "@testing-library/react"
import { BehaviorSubject } from "rxjs"
import { describe, expect, expectTypeOf, it } from "vitest"
import { createQueryClient, createWrapper } from "../../tests/liveQuery.tsx"
import { queryOptions$ } from "./queryOptions$.ts"
import { useLiveQuery$ } from "./useLiveQuery$.ts"
import { useQuery$ } from "./useQuery$.ts"

describe("queryOptions$", () => {
  it("returns the options it is given", () => {
    const options = {
      queryKey: ["prices"],
      queryFn: () => new BehaviorSubject(1),
    }

    expect(queryOptions$(options)).toBe(options)
  })

  it("tags the query key with the data type of the queryFn's observable", () => {
    const queryClient = createQueryClient()
    const pricesQueryOptions = queryOptions$({
      queryKey: ["prices"],
      queryFn: () => new BehaviorSubject([1, 2]),
    })

    expectTypeOf(
      queryClient.getQueryData(pricesQueryOptions.queryKey),
    ).toEqualTypeOf<number[] | undefined>()

    queryClient.setQueryData(pricesQueryOptions.queryKey, [3])

    // @ts-expect-error the data of the query is a number array
    queryClient.setQueryData(pricesQueryOptions.queryKey, "3")
  })

  it("gives useQuery$ and useLiveQuery$ the same query, whose data the client reads with the tagged key", async () => {
    const queryClient = createQueryClient()
    const prices$ = new BehaviorSubject([1, 2])
    const pricesQueryOptions = queryOptions$({
      queryKey: ["prices"],
      queryFn: () => prices$,
      networkMode: "always",
    })

    function Prices() {
      const { data: queriedPrices } = useQuery$(pricesQueryOptions)
      const { data: livePrices } = useLiveQuery$(pricesQueryOptions)

      return (
        <>
          <div data-testid="queried">{JSON.stringify(queriedPrices)}</div>
          <div data-testid="live">{JSON.stringify(livePrices)}</div>
        </>
      )
    }

    render(<Prices />, { wrapper: createWrapper(queryClient) })

    await waitFor(function waitForFirstPrices() {
      expect(screen.getByTestId("live").textContent).toBe("[1,2]")
    })
    expect(screen.getByTestId("queried").textContent).toBe("[1,2]")
    expect(queryClient.getQueryData(pricesQueryOptions.queryKey)).toEqual([
      1, 2,
    ])

    act(function pushNewPrices() {
      prices$.next([3])
    })

    await waitFor(function waitForNewPrices() {
      expect(screen.getByTestId("live").textContent).toBe("[3]")
    })
    expect(queryClient.getQueryData(pricesQueryOptions.queryKey)).toEqual([3])
  })
})
