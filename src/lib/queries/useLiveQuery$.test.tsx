import { QueryClient } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import { type ReactNode, useState } from "react"
import { BehaviorSubject, NEVER, of } from "rxjs"
import { describe, expect, expectTypeOf, it } from "vitest"
import {
  countSubscriptions,
  createQueryClient,
  createWrapper,
} from "../../tests/liveQuery"
import { waitForTimeout } from "../../tests/utils"
import { useLiveQueries$ } from "./useLiveQueries$"
import { type UseLiveQuery$Options, useLiveQuery$ } from "./useLiveQuery$"

const waitForData = (data: unknown) =>
  waitFor(() => {
    expect(screen.getByTestId("data").textContent).toBe(JSON.stringify(data))
  })

/**
 * A client with app-wide defaults that keep a regular query from fetching
 * again when a component mounts it, as long as its data was fetched before.
 */
function createClient(defaults: {
  staleTime?: number
  refetchOnMount?: boolean
}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Number.POSITIVE_INFINITY,
        networkMode: "always",
        ...defaults,
      },
    },
  })
}

const appWideDefaults = [
  { name: "staleTime", defaults: { staleTime: Number.POSITIVE_INFINITY } },
  { name: "refetchOnMount: false", defaults: { refetchOnMount: false } },
]

/**
 * Renders `Live` in a host that can hide and show it again.
 */
function renderToggled(queryClient: QueryClient, Live: () => ReactNode) {
  let toggle = () => {}

  function Host() {
    "use no memo"

    const [isVisible, setIsVisible] = useState(true)

    toggle = () => setIsVisible((value) => !value)

    return isVisible ? <Live /> : null
  }

  render(<Host />, { wrapper: createWrapper(queryClient) })

  return { toggle: () => act(() => toggle()) }
}

describe("useLiveQuery$", () => {
  for (const { name, defaults } of appWideDefaults) {
    it(`reopens the stream when a component mounts again, despite an app-wide ${name}`, {
      timeout: 3000,
    }, async () => {
      const source$ = new BehaviorSubject("a")
      const { counted$, subscriptions } = countSubscriptions(source$)

      function Live() {
        "use no memo"

        const { data } = useLiveQuery$({
          queryKey: ["live"],
          queryFn: () => counted$,
        })

        return <span data-testid="data">{JSON.stringify(data)}</span>
      }

      const { toggle } = renderToggled(createClient(defaults), Live)

      await waitForData("a")

      toggle()
      act(() => source$.next("b"))

      expect(subscriptions).toEqual({ made: 1, open: 0 })

      toggle()

      await waitForData("b")

      expect(subscriptions).toEqual({ made: 2, open: 1 })
    })
  }

  it("reopens the stream when it is enabled again, despite an app-wide staleTime", {
    timeout: 3000,
  }, async () => {
    const source$ = new BehaviorSubject("a")
    const { counted$, subscriptions } = countSubscriptions(source$)
    let setEnabled = (_enabled: boolean) => {}

    function Live() {
      "use no memo"

      const [enabled, setEnabledState] = useState(true)

      setEnabled = setEnabledState

      const { data } = useLiveQuery$({
        enabled,
        queryKey: ["live"],
        queryFn: () => counted$,
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Live />, {
      wrapper: createWrapper(
        createClient({ staleTime: Number.POSITIVE_INFINITY }),
      ),
    })

    await waitForData("a")

    act(() => setEnabled(false))
    await act(() => waitForTimeout(20))
    act(() => source$.next("b"))

    expect(subscriptions).toEqual({ made: 1, open: 0 })

    act(() => setEnabled(true))

    await waitForData("b")

    expect(subscriptions).toEqual({ made: 2, open: 1 })
  })

  it("opens the stream over initialData, despite an app-wide staleTime", {
    timeout: 3000,
  }, async () => {
    const source$ = new BehaviorSubject("a")
    const { counted$, subscriptions } = countSubscriptions(source$)

    function Live() {
      "use no memo"

      const { data } = useLiveQuery$({
        initialData: "initial",
        queryKey: ["live"],
        queryFn: () => counted$,
      })

      return <span data-testid="data">{JSON.stringify(data)}</span>
    }

    render(<Live />, {
      wrapper: createWrapper(
        createClient({ staleTime: Number.POSITIVE_INFINITY }),
      ),
    })

    await waitForData("a")

    expect(subscriptions).toEqual({ made: 1, open: 1 })
  })
})

describe("useLiveQueries$", () => {
  it("reopens every stream when a component mounts again, despite an app-wide staleTime", {
    timeout: 3000,
  }, async () => {
    const first$ = new BehaviorSubject("a")
    const second$ = new BehaviorSubject("x")
    const first = countSubscriptions(first$)
    const second = countSubscriptions(second$)

    function Live() {
      "use no memo"

      const [{ data: firstData }, { data: secondData }] = useLiveQueries$({
        queries: [
          { queryKey: ["live", "first"], queryFn: () => first.counted$ },
          { queryKey: ["live", "second"], queryFn: () => second.counted$ },
        ],
      })

      return (
        <span data-testid="data">
          {JSON.stringify([firstData, secondData])}
        </span>
      )
    }

    const { toggle } = renderToggled(
      createClient({ staleTime: Number.POSITIVE_INFINITY }),
      Live,
    )

    await waitForData(["a", "x"])

    toggle()
    act(() => {
      first$.next("b")
      second$.next("y")
    })
    toggle()

    await waitForData(["b", "y"])

    expect(first.subscriptions).toEqual({ made: 2, open: 1 })
    expect(second.subscriptions).toEqual({ made: 2, open: 1 })
  })
})

describe("live query hook types", () => {
  it("leave out the options they lock", () => {
    function Comp() {
      "use no memo"

      useLiveQuery$({
        queryKey: ["types", "staleTime"],
        queryFn: () => NEVER,
        // @ts-expect-error useLiveQuery$ locks staleTime to 0
        staleTime: 1000,
      })
      useLiveQuery$({
        queryKey: ["types", "refetchOnMount"],
        queryFn: () => NEVER,
        // @ts-expect-error useLiveQuery$ locks refetchOnMount to "always"
        refetchOnMount: false,
      })
      useLiveQueries$({
        queries: [
          {
            queryKey: ["types", "queries"],
            queryFn: () => NEVER,
            // @ts-expect-error useLiveQueries$ locks staleTime to 0
            staleTime: 1000,
          },
        ],
      })

      return null
    }

    render(<Comp />, { wrapper: createWrapper(createQueryClient()) })
  })

  it("export the options of useLiveQuery$ without the ones it locks", () => {
    expectTypeOf<UseLiveQuery$Options<number>>().not.toHaveProperty("staleTime")
    expectTypeOf<UseLiveQuery$Options<number>>().not.toHaveProperty(
      "refetchOnMount",
    )
    expectTypeOf<UseLiveQuery$Options<number>>().toHaveProperty("gcTime")
    expectTypeOf<
      UseLiveQuery$Options<number, Error, string>["select"]
    >().toEqualTypeOf<((data: number) => string) | undefined>()
  })

  it("infer data as useQuery$ and useQueries$ do", () => {
    function Comp() {
      "use no memo"

      const { data } = useLiveQuery$({
        queryKey: ["types", "select"],
        queryFn: () => of(1),
        select: (value) => String(value),
      })
      const [first, second] = useLiveQueries$({
        queries: [
          { queryKey: ["types", "number"], queryFn: () => of(1) },
          { queryKey: ["types", "string"], queryFn: () => of("a") },
        ],
      })

      expectTypeOf(data).toEqualTypeOf<string | undefined>()
      expectTypeOf(first.data).toEqualTypeOf<number | undefined>()
      expectTypeOf(second.data).toEqualTypeOf<string | undefined>()

      return null
    }

    render(<Comp />, { wrapper: createWrapper(createQueryClient()) })
  })
})
