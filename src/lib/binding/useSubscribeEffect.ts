import { useCallback } from "react"
import { of, retry, tap, throwError } from "rxjs"
import { makeObservable } from "../utils/makeObservable"
import { useLiveRef } from "../utils/react/useLiveRef"
import type { SubscribeSource } from "./useSubscribe/types"
import { useSubscribe } from "./useSubscribe/useSubscribe"

interface Option {
  retryOnError?: boolean
  onError?: (error: unknown) => void
}

export function useSubscribeEffect<T>(
  source: SubscribeSource<T>,
  options?: Option,
) {
  const optionsRef = useLiveRef(options)

  const enhancerMakeObservable = useCallback(() => {
    const source$ = makeObservable(source)()

    return source$.pipe(
      tap({
        error: (error) => {
          optionsRef.current?.onError?.(error)
        },
      }),
      retry({
        delay: (error) =>
          optionsRef.current?.retryOnError ? of(0) : throwError(() => error),
      }),
    )
  }, [source, optionsRef])

  useSubscribe(enhancerMakeObservable)
}
