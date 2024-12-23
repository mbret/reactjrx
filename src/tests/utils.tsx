/* eslint-disable no-import-assign */
import { act, render } from "@testing-library/react"
import {
  QueryClient,
  type QueryClientConfig
} from "../lib/deprecated/client/QueryClient"
import { QueryClientProvider } from "../lib/deprecated/react/QueryClientProvider"
import React from "react"
import * as utils from "../lib/utils"

export const waitForTimeout = async (timeout: number) =>
  await new Promise<undefined>((resolve) => setTimeout(resolve, timeout))

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

/**
 * @see https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/utils.tsx
 */
export function createQueryClient(config?: QueryClientConfig): QueryClient {
  return new QueryClient(config)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const doNotExecute = (_func: () => void) => true

/**
 * Assert the parameter is not typed as `any`
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
