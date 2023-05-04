import { afterEach, describe, expect, it, vi } from 'vitest'
import { Subject, of } from 'rxjs'
import { render, cleanup } from '@testing-library/react'
import { useQuery } from '../useQuery'

afterEach(() => {
  cleanup()
})

describe('useQuery', () => {
  describe('Given a query which runs once', () => {
    describe('and the query is a promise', () => {
      describe('when the query finish before the stale timeout', () => {
        it('should refetch', async () => {
          const queryFn = vi.fn().mockImplementation(async () => undefined)
          const staleTimeout = 1

          const Comp = () => {
            useQuery(queryFn, {
              staleTime: staleTimeout
            })

            return null
          }

          render(<Comp />)

          expect(queryFn).toHaveBeenCalledTimes(1)

          await new Promise((resolve) => setTimeout(resolve, staleTimeout + 2))

          expect(queryFn.mock.calls.length).toBeGreaterThanOrEqual(2)
        })
      })
    })

    describe('and the query is an observable', () => {
      describe('when the query finish before the stale timeout', () => {
        it('should refetch', async () => {
          const queryFn = vi.fn().mockImplementation(async () => of(undefined))
          const staleTimeout = 1

          const Comp = () => {
            useQuery(queryFn, {
              staleTime: staleTimeout
            })

            return null
          }

          render(<Comp />)

          expect(queryFn).toHaveBeenCalledTimes(1)

          await new Promise((resolve) => setTimeout(resolve, staleTimeout + 1))

          expect(queryFn.mock.calls.length).toBeGreaterThanOrEqual(2)
        })
      })

      describe('when the query take longer than the stale timeout', () => {
        it('should not refetch', async () => {
          const triggerSubject = new Subject()
          const queryFn = vi.fn().mockImplementation(async () => undefined)
          const staleTimeout = 1

          const Comp = () => {
            useQuery(queryFn, {
              staleTime: staleTimeout
            })

            return null
          }

          render(<Comp />)

          expect(queryFn).toHaveBeenCalledTimes(1)

          // await new Promise((resolve) => setTimeout(resolve, staleTimeout + 2))

          // expect(queryFn.mock.calls.length).toBeGreaterThanOrEqual(2)
        })
      })
    })
  })
})
