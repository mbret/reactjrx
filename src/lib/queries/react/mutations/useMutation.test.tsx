import { afterEach, describe, expect, it } from "vitest"
import {
  type Observable,
  finalize,
  takeUntil,
  timer,
  ReplaySubject
} from "rxjs"
import { render, cleanup } from "@testing-library/react"
import React, { useEffect, useState } from "react"
import { useMutation } from "./useMutation"
import { QueryClientProvider } from "../QueryClientProvider"
import { QueryClient } from "../../client/QueryClient"
import { waitForTimeout } from "../../../../tests/utils"

afterEach(() => {
  cleanup()
})

describe("useMutation", () => {
  describe("Given two consecutive async query triggered", () => {
    describe("when map operator is merge", () => {
      it("should only show the second query result", async () => {
        const client = new QueryClient()

        const Comp = () => {
          const [done, setDone] = useState({ 1: false, 2: false })
          const [values, setValues] = useState<Array<number | undefined>>([])
          const { data, mutate } = useMutation({
            mutationFn: async ({
              res,
              timeout
            }: {
              res: number
              timeout: number
            }) => {
              return await new Promise<number>((resolve) =>
                setTimeout(() => {
                  resolve(res)
                }, timeout)
              )
            },
            onSuccess: (data) => {
              setDone((s) => ({ ...s, [data]: true }))
            }
          })

          useEffect(() => {
            data && setValues((v) => [...v, data])
          }, [data])

          useEffect(() => {
            mutate({ res: 1, timeout: 5 })
            mutate({ res: 2, timeout: 1 })
          }, [mutate])

          // we only display content once all queries are done
          // this way when we text string later we know exactly
          return <>{done[1] && done[2] ? values : ""}</>
        }

        const { findByText } = render(
          <React.StrictMode>
            <QueryClientProvider client={client}>
              <Comp />
            </QueryClientProvider>
          </React.StrictMode>
        )

        expect(await findByText("2")).toBeDefined()
      })
    })

    describe("when map operator is concat", () => {
      it("should show results sequentially", async () => {
        const client = new QueryClient()

        const Comp = () => {
          const [done, setDone] = useState({ 1: false, 2: false })
          const [values, setValues] = useState<Array<number | undefined>>([])
          const { data, mutate } = useMutation({
            mutationFn: async ({
              res,
              timeout
            }: {
              res: number
              timeout: number
            }) => {
              return await new Promise<number>((resolve) =>
                setTimeout(() => {
                  resolve(res)
                }, timeout)
              )
            },
            mapOperator: "concat",
            onSuccess: (data) => {
              setDone((s) => ({ ...s, [data]: true }))
            }
          })

          useEffect(() => {
            data && setValues((v) => [...v, data])
          }, [data])

          useEffect(() => {
            mutate({ res: 1, timeout: 3 })
            mutate({ res: 2, timeout: 1 })
          }, [mutate])

          // we only display content once all queries are done
          // this way when we text string later we know exactly
          return <>{done[1] && done[2] ? values.join(",") : ""}</>
        }

        const { findByText } = render(
          <React.StrictMode>
            <QueryClientProvider client={client}>
              <Comp />
            </QueryClientProvider>
          </React.StrictMode>
        )

        expect(await findByText("1,2")).toBeDefined()
      })
    })

    describe("when map operator is switch", () => {
      it("should not show results sequentially", async () => {
        const client = new QueryClient()

        const Comp = () => {
          const [done, setDone] = useState({ 1: false, 2: false })
          const [values, setValues] = useState<Array<number | undefined>>([])
          const { data, mutate } = useMutation({
            mutationFn: async ({
              res,
              timeout
            }: {
              res: number
              timeout: number
            }) => {
              return await new Promise<number>((resolve) =>
                setTimeout(() => {
                  resolve(res)
                }, timeout)
              )
            },
            mapOperator: "switch",
            onSuccess: (data) => {
              setDone((s) => ({ ...s, [data]: true }))
            }
          })

          useEffect(() => {
            data && setValues((v) => [...v, data])
          }, [data])

          useEffect(() => {
            mutate({ res: 1, timeout: 1 })
            mutate({ res: 2, timeout: 3 })
          }, [mutate])

          // we only display content once all queries are done
          // this way when we text string later we know exactly
          return <>{done[2] ? values.join(",") : ""}</>
        }

        const { findByText } = render(
          <React.StrictMode>
            <QueryClientProvider client={client}>
              <Comp />
            </QueryClientProvider>
          </React.StrictMode>
        )

        expect(await findByText("2")).toBeDefined()
      })
    })
  })

  describe("Given async function which returns 2", () => {
    describe("and component renders its data", () => {
      it("should returns 2 when called", async () => {
        const client = new QueryClient()

        const Comp = () => {
          const { data, mutate } = useMutation({ mutationFn: async () => 2 })

          useEffect(() => {
            mutate()
          }, [mutate])

          return <>{data}</>
        }

        const { findByText } = render(
          <React.StrictMode>
            <QueryClientProvider client={client}>
              <Comp />
            </QueryClientProvider>
          </React.StrictMode>
        )

        expect(await findByText("2")).toBeDefined()
      })
    })
  })

  describe("Given a call to mutate when component is unmounted", () => {
    it("should not call the function", async () => {
      let called = 0

      const client = new QueryClient()

      const Comp = () => {
        const { data, mutate } = useMutation({
          mutationFn: async () => {
            called++

            return 2
          }
        })

        useEffect(
          () => () => {
            setTimeout(() => {
              mutate()
            }, 1)
          },
          [mutate]
        )

        return <>{data}</>
      }

      const { unmount } = render(
        <React.StrictMode>
          <QueryClientProvider client={client}>
            <Comp />
          </QueryClientProvider>
        </React.StrictMode>
      )

      unmount()

      expect(called).toBe(0)
    })
  })

  describe("Given component unmount", () => {
    // describe("and there was an active mutation", () => {
    //   it("should complete and remove the result from this key in results$", async () => {
    //     const client = new QueryClient()

    //     const Comp = () => {
    //       const { mutate } = useMutation({
    //         mutationKey: ["foo"],
    //         mutationFn: async () => {}
    //       })

    //       useEffect(() => {
    //         mutate()
    //       }, [mutate])

    //       return null
    //     }

    //     const { unmount } = render(
    //       <React.StrictMode>
    //         <QueryClientProvider client={client}>
    //           <Comp />
    //         </QueryClientProvider>
    //       </React.StrictMode>
    //     )

    //     unmount()

    //     /**
    //      * - promise is async
    //      * - gc may happens on next tick
    //      */
    //     await waitForTimeout(2)

    //     const resultForKey =
    //       client.mutationObserver.mutationResults$.getValue()[
    //         serializeKey(["foo"])
    //       ]

    //     expect(resultForKey).toBeUndefined()
    //   })
    // })

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
          const { mutate } = useMutation({
            mutationFn: () =>
              timer(1000).pipe(
                takeUntil(manualStop),
                finalize(() => {
                  finalized++
                })
              )
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
          </React.StrictMode>
        )

        unmount()

        // observable should not be forcefully closed
        expect(finalized).toBe(0)

        // we simulate a long observable to stop after a while
        manualStop.next()

        await waitForTimeout(10)

        expect(finalized).toBe(unmountTime)
      })

      describe("and the query is a Promise that throws", () => {
        it("should call onError", async () => {
          let onErrorCall = 0
          let unmountTime = 0

          const client = new QueryClient()

          const Comp = () => {
            const { mutate } = useMutation({
              mutationFn: async () => {
                throw new Error("foo")
              },
              retry: false,
              onError: () => {
                onErrorCall++
              }
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
            </React.StrictMode>
          )

          unmount()

          await new Promise((resolve) => setTimeout(resolve, 10))

          expect(onErrorCall).toBe(unmountTime)
        })
      })

      describe("and option cancelOnUnmount is true", () => {
        it("should forcefully complete query", async () => {
          let finalized = 0
          let unmountTime = 0
          let queryFinalizedNumberOfTime = 0

          const client = new QueryClient()

          const Comp = () => {
            const { mutate } = useMutation({
              cancelOnUnMount: true,
              mutationFn: () =>
                timer(1000).pipe(
                  finalize(() => {
                    queryFinalizedNumberOfTime++
                  })
                ),
              __queryFinalizeHook: (source: Observable<any>) =>
                source.pipe(
                  finalize(() => {
                    finalized++
                  })
                )
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
            </React.StrictMode>
          )

          await waitForTimeout(10)

          unmount()

          // only 1 because the query may not have run yet when unmounted directly after strict mode
          expect(unmountTime).toBe(2)
          expect(queryFinalizedNumberOfTime).toBe(2)
          expect(finalized).toBe(2)
        })

        describe("and the query is a Promise that throws", () => {
          it("should not call onError", async () => {
            let onErrorCall = 0

            const client = new QueryClient()

            const Comp = () => {
              const { mutate } = useMutation({
                mutationFn: async () => {
                  return await new Promise((_resolve, reject) => {
                    setTimeout(() => {
                      reject(new Error("error"))
                    }, 1)
                  })
                },
                cancelOnUnMount: true,
                retry: false,
                onError: () => {
                  onErrorCall++
                }
              })

              useEffect(() => {
                mutate()
              }, [mutate])

              return null
            }

            const { unmount } = render(
              <React.StrictMode>
                <QueryClientProvider client={client}>
                  <Comp />
                </QueryClientProvider>
              </React.StrictMode>
            )

            unmount()

            await waitForTimeout(10)

            expect(onErrorCall).toBe(0)
          })
        })
      })
    })
  })
})
