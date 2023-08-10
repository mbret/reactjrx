import { useEffect } from "react"
import { useBehaviorSubject } from "../../binding/useBehaviorSubject"
import { type QueryFn } from "../client/types"
import { type UseQueryOptions } from "./types"

export const useQueryParams = <T>({
  queryKey,
  queryFn,
  ...options
}: {
  queryKey?: any[]
  queryFn?: QueryFn<T>
} & UseQueryOptions<T>) => {
  const params$ = useBehaviorSubject({ queryKey, options, queryFn })

  useEffect(() => {
    params$.current.next({
      queryKey,
      options,
      queryFn
    })
  }, [queryKey, options, queryFn])

  return params$
}
