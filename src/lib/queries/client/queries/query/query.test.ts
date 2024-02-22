import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createQueryClient, sleep } from "../../../../../tests/utils"
import { type QueryClient } from "../../QueryClient"
import { QueryObserver } from "../observer/QueryObserver"
import { finalize, interval } from "rxjs"

describe("query", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createQueryClient()
    queryClient.mount()
  })

  afterEach(() => {
    queryClient.clear()
  })

  it("should complete forever query as soon as there is no more observers", async () => {
    const finalizeFn = vi.fn()

    const observer = new QueryObserver(queryClient, {
      queryKey: ["foo"],
      queryFn: () => interval(10).pipe(finalize(finalizeFn))
    })

    const subscription = observer.observe().subscribe()

    await sleep(12)

    expect(observer.getCurrentResult()).toMatchObject({
      data: 0,
      fetchStatus: "fetching"
    })

    expect(finalizeFn).not.toBeCalled()

    await sleep(12)

    expect(observer.getCurrentResult()).toMatchObject({
      data: 1,
      fetchStatus: "fetching"
    })

    subscription.unsubscribe()

    await sleep(2)

    expect(observer.getCurrentResult()).toMatchObject({
      data: 1,
      fetchStatus: "idle"
    })

    expect(finalizeFn).toBeCalled()
  })

  it("should complete forever query on first result when there is no observers at all", async () => {
    const finalizeFn = vi.fn()
    const thenFn = vi.fn()

    const promise = queryClient.fetchQuery({
      queryKey: ["foo"],
      queryFn: () => interval(10).pipe(finalize(finalizeFn))
    })

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    promise.then(thenFn)

    const query = queryClient.getQueryCache().findAll()[0]

    await sleep(5)

    expect(query?.state).toMatchObject({
      data: undefined,
      fetchStatus: "fetching"
    })

    expect(finalizeFn).not.toBeCalled()

    await sleep(12)

    expect(query?.state).toMatchObject({
      data: 0,
      fetchStatus: "idle"
    })

    expect(finalizeFn).toBeCalled()
    expect(thenFn).toBeCalledWith(0)
  })
})
