import { act, render } from "@testing-library/react"
import { QueryClient } from "../lib/queries/client/createClient"
import { QueryClientProvider } from "../lib/queries/react/Provider"

export const waitForTimeout = async (timeout: number) =>
  await new Promise((resolve) => setTimeout(resolve, timeout))

/**
 * @see https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/utils.tsx
 */
export async function sleep(timeout: number): Promise<void> {
  await new Promise((resolve, _reject) => {
    setTimeout(resolve, timeout)
  })
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
export function createQueryClient(): QueryClient {
  return new QueryClient()
}
