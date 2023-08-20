import { type Observable, fromEvent, map, switchMap, EMPTY } from "rxjs"
import { type UseQueryOptions } from "../types"

export const createNetworkTrigger = <T>(
  params$: Observable<{ options: UseQueryOptions<T> }>
) => {
  return params$.pipe(
    switchMap(({ options: { refetchOnReconnect = true } }) => {
      const shouldRunTrigger =
        typeof refetchOnReconnect === "function"
          ? refetchOnReconnect({})
          : refetchOnReconnect

      return shouldRunTrigger !== false
        ? fromEvent(window, "online").pipe(
            map(() => ({
              type: "refetch" as const,
              ignoreStale: shouldRunTrigger === "always"
            }))
          )
        : EMPTY
    })
  )
}
