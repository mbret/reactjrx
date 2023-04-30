import { afterEach, describe, expect, it } from "vitest"
import { Observable, Subject, finalize, takeUntil, timer } from "rxjs"
import { render } from "@testing-library/react"
import React, { useEffect } from "react"
import { cleanup } from "@testing-library/react"
import { useMutation } from "./useMutation"

afterEach(() => {
  cleanup()
})

describe("useMutation", () => {
  describe("Given a call to mutate when component is unmounted", () => {
    it("should not call the function", async () => {
      let called = 0

      const Comp = () => {
        const { data, mutate } = useMutation(async () => {
          called++
        })

        useEffect(
          () => () => {
            setTimeout(() => {
              mutate()
            }, 1)
          },
          []
        )

        return <>{data}</>
      }

      const { unmount } = render(
        <React.StrictMode>
          <Comp />
        </React.StrictMode>
      )

      unmount()

      expect(called).toBe(0)
    })
  })

  describe("Given component unmount", () => {
    describe("when there is no active mutation occurring", () => {
      /**
       * @disclaimer
       * I could not find a way to test the completeness of the inner observable without "cheating"
       * by adding a hook. It's anti pattern but will do it until I find better way
       */
      it("should complete main observable chain", async () => {
        let finalized = 0
        let unmountTime = 0

        const Comp = () => {
          useMutation(async () => {}, {
            hooks: (source: Observable<any>) =>
              source.pipe(
                finalize(() => {
                  finalized++
                })
              )
          })

          useEffect(
            () => () => {
              unmountTime++
            },
            []
          )

          return null
        }

        const { unmount } = render(
          <React.StrictMode>
            <Comp />
          </React.StrictMode>
        )

        unmount()

        expect(finalized).toBe(unmountTime)
      })
    })

    describe("when there is an active mutation occurring", () => {
      /**
       * @disclaimer
       * I could not find a way to test the completeness of the inner observable without "cheating"
       * by adding a hook. It's anti pattern but will do it until I find better way
       */
      it("should complete main observable chain", async () => {
        let finalized = 0
        let unmountTime = 0
        const manualStop = new Subject<void>()

        const Comp = () => {
          const { mutate } = useMutation(
            () => timer(1000).pipe(takeUntil(manualStop)),
            {
              hooks: (source: Observable<any>) =>
                source.pipe(
                  finalize(() => {
                    finalized++
                  })
                )
            }
          )

          useEffect(() => {
            mutate()

            return () => {
              unmountTime++
            }
          }, [])

          return null
        }

        const { unmount } = render(
          <React.StrictMode>
            <Comp />
          </React.StrictMode>
        )

        unmount()

        // observable should not be forcefully closed
        expect(finalized).toBe(0)

        // we simulate a long observable to stop after a while
        manualStop.next()

        expect(finalized).toBe(unmountTime)
      })

      describe("and the mutation is a Promise that throws", () => {
        it("should call onError", async () => {
          let onErrorCall = 0
          let unmountTime = 0

          const Comp = () => {
            const { mutate } = useMutation(
              async () => {
                throw new Error("foo")
              },
              {
                retry: false,
                onError: () => {
                  onErrorCall++
                }
              }
            )

            useEffect(() => {
              mutate()

              return () => {
                unmountTime++
              }
            }, [])

            return null
          }

          const { unmount } = render(
            <React.StrictMode>
              <Comp />
            </React.StrictMode>
          )

          unmount()

          await new Promise((resolve) => setTimeout(resolve, 10))

          expect(onErrorCall).toBe(unmountTime)
        })
      })

      describe("and option cancelOnUnmount is true", () => {
        it("should forcefully complete mutation", async () => {
          let finalized = 0
          let unmountTime = 0
          let mutationClosed = 0

          const Comp = () => {
            const { mutate } = useMutation(
              () =>
                timer(1000).pipe(
                  finalize(() => {
                    mutationClosed++
                  })
                ),
              {
                cancelOnUnMount: true,
                hooks: (source: Observable<any>) =>
                  source.pipe(
                    finalize(() => {
                      finalized++
                    })
                  )
              }
            )

            useEffect(() => {
              mutate()

              return () => {
                unmountTime++
              }
            }, [])

            return null
          }

          const { unmount } = render(
            <React.StrictMode>
              <Comp />
            </React.StrictMode>
          )

          unmount()

          expect(finalized).toBe(unmountTime)
          expect(mutationClosed).toBe(unmountTime)
          expect(mutationClosed).toBe(unmountTime)
        })

        describe("and the mutation is a Promise that throws", () => {
          it("should not call onError", async () => {
            let onErrorCall = 0

            const Comp = () => {
              const { mutate } = useMutation(
                async () => {
                  throw new Error("foo")
                },
                {
                  cancelOnUnMount: true,
                  retry: false,
                  onError: () => {
                    onErrorCall++
                  }
                }
              )

              useEffect(() => {
                mutate()
              }, [])

              return null
            }

            const { unmount } = render(
              <React.StrictMode>
                <Comp />
              </React.StrictMode>
            )

            unmount()

            await new Promise((resolve) => setTimeout(resolve, 10))

            expect(onErrorCall).toBe(0)
          })
        })
      })
    })
  })
})
