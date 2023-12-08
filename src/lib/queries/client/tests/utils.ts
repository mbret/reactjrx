import { lastValueFrom } from "rxjs"
import { type QueryClient } from "../createClient"
import { type MutationOptions } from "../mutations/types"

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
