import { type DependencyList, useCallback } from "react"
import { catchError, identity, retry } from "rxjs"
import { useSubscribe } from "./useSubscribe"
import { useLiveRef } from "../utils/react/useLiveRef"
import { makeObservable } from "../queries/client/utils/makeObservable"
import { type SubscribeSource } from "./types"

interface Option {
  retry?: boolean
  onError?: (error: unknown) => void
}

export function useSubscribeEffect<T>(source: SubscribeSource<T>): void
export function useSubscribeEffect<T>(
  source: SubscribeSource<T>,
  options: Option
): void

export function useSubscribeEffect<T>(
  source: SubscribeSource<T>,
  deps: DependencyList
): void

export function useSubscribeEffect<T>(
  source: SubscribeSource<T>,
  options: Option,
  deps: DependencyList
): void

export function useSubscribeEffect<T>(
  source: SubscribeSource<T>,
  unsafeOptions?: Option | DependencyList,
  deps: DependencyList = []
) {
  const options =
    unsafeOptions != null && !Array.isArray(unsafeOptions)
      ? (unsafeOptions as Option)
      : ({} satisfies Option)
  const retryOption = options.retry ?? true
  const onErrorRef = useLiveRef(
    options.onError ??
      ((error: unknown) => {
        console.error(error)
      })
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sourceAsObservable = useCallback(() => makeObservable(source), deps)

  const enhancerMakeObservable = useCallback(
    () =>
      sourceAsObservable().pipe(
        catchError((error) => {
          onErrorRef.current(error)

          throw error
        }),
        retryOption ? retry() : identity
      ),
    [sourceAsObservable, retryOption, onErrorRef]
  )

  useSubscribe(enhancerMakeObservable, deps)
}
