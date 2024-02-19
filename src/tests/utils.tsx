/* eslint-disable no-import-assign */
import { act, render } from "@testing-library/react"
import { QueryClient } from "../lib/queries/client/QueryClient"
import { QueryClientProvider } from "../lib/queries/react/QueryClientProvider"
import { MutationCache } from "../lib/queries/client/mutations/cache/MutationCache"
import { type QueryCache } from "../lib/queries/client/queries/cache/QueryCache"
import React from "react"
import * as utils from "../lib/utils"

export const waitForTimeout = async (timeout: number) =>
  await new Promise((resolve) => setTimeout(resolve, timeout))

/**
 * @see https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/utils.tsx
 */
export async function sleep(timeout: number): Promise<void> {
  await waitForTimeout(timeout)
}

/**
 * @see https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/utils.tsx
 */
export function setActTimeout(fn: () => void, ms?: number) {
  return setTimeout(() => {
    act(() => {
      fn()
    })
  }, ms)
}

/**
 * @see https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/utils.tsx
 */
export function renderWithClient(
  client: QueryClient,
  ui: React.ReactElement
): ReturnType<typeof render> {
  const { rerender, ...result } = render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  )
  return {
    ...result,
    rerender: (rerenderUi: React.ReactElement) => {
      rerender(
        <QueryClientProvider client={client}>{rerenderUi}</QueryClientProvider>
      )
    }
  } as any
}

/**
 * @see https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/utils.tsx
 */
export function createQueryClient(
  params: {
    mutationCache?: MutationCache
    queryCache?: QueryCache
  } = { mutationCache: new MutationCache() }
): QueryClient {
  return new QueryClient(params)
}

export const doNotExecute = (_func: () => void) => true

/**
 * Assert the parameter is not typed as `any`
 */
export function expectTypeNotAny<T>(_: 0 extends 1 & T ? never : T): void {
  return undefined
}

export const Blink = ({
  duration,
  children
}: {
  duration: number
  children: React.ReactNode
}) => {
  const [shouldShow, setShouldShow] = React.useState<boolean>(true)

  React.useEffect(() => {
    setShouldShow(true)
    const timeout = setActTimeout(() => {
      setShouldShow(false)
    }, duration)
    return () => {
      clearTimeout(timeout)
    }
  }, [duration, children])

  return shouldShow ? <>{children}</> : <>off</>
}

// This monkey-patches the isServer-value from utils,
// so that we can pretend to be in a server environment
export function setIsServer(isServer: boolean) {
  const original = utils.isServer
  Object.defineProperty(utils, "isServer", {
    get: () => isServer
  })

  return () => {
    Object.defineProperty(utils, "isServer", {
      get: () => original
    })
  }
}
