import { afterEach, describe, expect, it } from "vitest"
import { Subject, interval, noop, of, tap } from "rxjs"
import { render, cleanup } from "@testing-library/react"
import React, { memo, useEffect, useRef, useState } from "react"
import { useQuery } from "./useQuery"
import { printQuery } from "../../../../tests/testUtils"
import { useSubscribe } from "../../../binding/useSubscribe"
import { QueryClient, QueryClientProvider } from "../../../.."
import { waitForTimeout } from "../../../../tests/utils"

afterEach(() => {
  cleanup()
})

describe("useQuery", () => {
  // describe("Given a query that returns an interval stream", () => {
  //   it("should return consecutive results", async () => {
  //     const Comp = () => {
  //       const [values, setValues] = useState<Array<number | undefined>>([])

  //       const { data } = useQuery({ queryKey: [], queryFn: () => interval(1) })

  //       useEffect(() => {
  //         data && setValues((v) => [...v, data])
  //       }, [data])

  //       return <>{JSON.stringify(values)}</>
  //     }

  //     const client = new QueryClient()

  //     const { findByText } = render(
  //       <React.StrictMode>
  //         <QueryClientProvider client={client}>
  //           <Comp />
  //         </QueryClientProvider>
  //       </React.StrictMode>
  //     )

  //     expect(await findByText(JSON.stringify([1, 2, 3]))).toBeDefined()
  //   })
  // })

  // it("should return consecutive results", async () => {
  //   // interval big enough so react does not skip some render
  //   const source = interval(10)

  //   const Comp = () => {
  //     const [values, setValues] = useState<Array<number | undefined>>([])

  //     const queryResult = useQuery({ queryKey: [], queryFn: source })

  //     const { data } = queryResult

  //     useEffect(() => {
  //       data && setValues((v) => [...v, data])
  //     }, [data])

  //     return <>{values.join(",")}</>
  //   }

  //   const client = new QueryClient()

  //   const { findByText } = render(
  //     <React.StrictMode>
  //       <QueryClientProvider client={client}>
  //         <Comp />
  //       </QueryClientProvider>
  //     </React.StrictMode>
  //   )

  //   expect(await findByText("1,2,3")).toBeDefined()
  // })

  it("should return consecutive results", async () => {
    const source = new Subject<number>()

    const Comp = () => {
      const [values, setValues] = useState<Array<number | undefined>>([])

      const queryResult = useQuery({ queryKey: [], queryFn: source })

      const { data } = queryResult

      useEffect(() => {
        data && setValues((v) => [...v, data])
      }, [data])

      return <>{JSON.stringify(values)}</>
    }

    const client = new QueryClient()

    const { findByText } = render(
      <React.StrictMode>
        <QueryClientProvider client={client}>
          <Comp />
        </QueryClientProvider>
      </React.StrictMode>
    )

    source.next(3)

    await waitForTimeout(1)

    source.next(2)

    await waitForTimeout(1)

    source.next(1)

    expect(await findByText(JSON.stringify([3, 2, 1]))).toBeDefined()
  })

  // describe("Given a new source every render", () => {
  //   it("should infinite render and throw", async () => {
  //     const Comp = () => {
  //       const renderCount = useRef(0)

  //       useQuery({ queryFn: of(renderCount.current) })

  //       useEffect(() => {
  //         renderCount.current++

  //         if (renderCount.current > 20) {
  //           throw new Error("too many render")
  //         }
  //       })

  //       return null
  //     }

  //     const client = new QueryClient()

  //     expect(() =>
  //       render(
  //         <React.StrictMode>
  //           <QueryClientProvider client={client}>
  //             <Comp />
  //           </QueryClientProvider>
  //         </React.StrictMode>
  //       )
  //     ).to.toThrowError("too many render")
  //   })

  //   it("should disable query once render count reach 10 and therefore return 10", async () => {
  //     const Comp = memo(() => {
  //       const renderCount = useRef(0)

  //       const result = useQuery({
  //         queryKey: [],
  //         queryFn: of(renderCount.current),
  //         enabled: renderCount.current < 11
  //       })

  //       useEffect(() => {
  //         renderCount.current++

  //         // we use a margin because of strict mode / concurrency
  //         if (renderCount.current > 20) {
  //           throw new Error("too many render")
  //         }
  //       })

  //       return <>{result.data}</>
  //     })

  //     const client = new QueryClient()

  //     const { findByText } = render(
  //       <React.StrictMode>
  //         <QueryClientProvider client={client}>
  //           <Comp />
  //         </QueryClientProvider>
  //       </React.StrictMode>
  //     )

  //     expect(await findByText("10")).toBeDefined()
  //   })
  // })

  // describe("Given a query that change every render and a stable key", () => {
  //   describe("when user refetch said query", () => {
  //     it("should return result of latest query instance", async () => {
  //       const changeQueryTrigger = new Subject<void>()

  //       const Comp = () => {
  //         const [query, setQuery] = useState(() => async () => 1)

  //         const result = useQuery({
  //           queryFn: query,
  //           queryKey: ["foo"]
  //         })

  //         const { refetch } = result

  //         useSubscribe(
  //           changeQueryTrigger.pipe(
  //             tap(() => {
  //               setQuery(() => async () => 2)
  //             })
  //           )
  //         )

  //         useEffect(() => {
  //           refetch().catch(noop)
  //         }, [query, refetch])

  //         return <>{printQuery(result)}</>
  //       }

  //       const client = new QueryClient()

  //       const { findByText } = render(
  //         <React.StrictMode>
  //           <QueryClientProvider client={client}>
  //             <Comp />
  //           </QueryClientProvider>
  //         </React.StrictMode>
  //       )

  //       expect(
  //         await findByText(
  //           printQuery({
  //             data: 1,
  //             error: undefined,
  //             fetchStatus: "idle",
  //             isLoading: false,
  //             status: "success"
  //           })
  //         )
  //       ).toBeDefined()

  //       changeQueryTrigger.next()

  //       expect(
  //         await findByText(
  //           printQuery({
  //             data: 2,
  //             error: undefined,
  //             fetchStatus: "idle",
  //             isLoading: false,
  //             status: "success"
  //           })
  //         )
  //       ).toBeDefined()
  //     })
  //   })
  // })
})
