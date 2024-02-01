import { lastValueFrom } from "rxjs"
import { type QueryClient } from "../QueryClient"
import { type MutationOptions } from "../mutations/mutation/types"
import { type SpyInstance, vi } from "vitest"
import { onlineManager } from "../onlineManager"
import { focusManager } from "../focusManager"

let queryKeyCount = 0
export function queryKey(): string[] {
  queryKeyCount++
  return [`query_${queryKeyCount}`]
}

export const executeMutation = async <TVariables>(
  queryClient: QueryClient,
  options: MutationOptions<any, any, TVariables, any>,
  variables: TVariables
) => {
  return await lastValueFrom(
    queryClient
      .getMutationCache()
      .build(queryClient, options)
      .execute(variables)
  )
}

export function mockOnlineManagerIsOnline(
  value: boolean
): SpyInstance<[], boolean> {
  return vi.spyOn(onlineManager, "isOnline").mockReturnValue(value)
}

export function mockVisibilityState(
  value: DocumentVisibilityState
): SpyInstance<[], DocumentVisibilityState> {
  const mock = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue(value)

  focusManager.refresh()

  const _mockRestore = mock.mockRestore

  mock.mockRestore = () => {
    _mockRestore()
    focusManager.refresh()
  }

  return mock
}
