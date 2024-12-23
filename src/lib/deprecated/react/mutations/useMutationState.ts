import { useObserve } from "../../../binding/useObserve"
import { type MutationFilters } from "../../client/mutations/types"
import { useLiveRef } from "../../../utils/react/useLiveRef"
import { type Mutation } from "../../client/mutations/mutation/Mutation"
import { distinctUntilChanged, map, skip } from "rxjs"
import { type QueryClient } from "../../client/QueryClient"
import { type MutationState } from "../../client/mutations/mutation/types"
import { useQueryClient } from "../useQueryClient"
import { useConstant } from "../../../utils/react/useConstant"
import { shallowEqual } from "../../../utils/shallowEqual"

export interface MutationStateOptions<TResult, TData> {
  filters?: MutationFilters<TData>
  select?: (mutation: Mutation<any>) => TResult
}

export const useMutationState = <TData, TResult = MutationState>(
  options: MutationStateOptions<TResult, TData> = {},
  queryClient?: QueryClient
): TResult[] => {
  const finalQueryClient = useQueryClient(queryClient)
  const mutationCache = finalQueryClient.getMutationCache()
  const optionsRef = useLiveRef(options)

  const defaultValue = useConstant(() =>
    mutationCache
      .findAll(optionsRef.current.filters)
      .map(
        (mutation): TResult =>
          (options.select
            ? options.select(mutation)
            : mutation.state) as TResult
      )
  )

  const result = useObserve(
    () => {
      const value$ = mutationCache.observe()

      return value$.pipe(
        skip(1),
        map(() => {
          return mutationCache
            .findAll(optionsRef.current.filters)
            .map(
              (mutation): TResult =>
                (options.select
                  ? options.select(mutation)
                  : mutation.state) as TResult
            )
        }),
        distinctUntilChanged(shallowEqual)
      )
    },
    { defaultValue: defaultValue.current },
    []
  )

  return result
}
