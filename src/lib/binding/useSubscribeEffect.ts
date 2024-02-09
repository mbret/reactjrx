import { type DependencyList, useCallback } from "react"
import { type Observable, catchError, identity, retry } from "rxjs"
import { useSubscribe } from "./useSubscribe"
import { useLiveRef } from "../utils/useLiveRef"
import { makeObservable } from "../queries/client/utils/functionAsObservable"

interface Option {
  retry?: boolean
  onError?: (error: unknown) => void
}

export function useSubscribeEffect<T>(source: Observable<T>): void
export function useSubscribeEffect<T>(
  source: Observable<T>,
  options: Option
): void

export function useSubscribeEffect<T>(
  source: () => Observable<T>,
  deps: DependencyList
): void

export function useSubscribeEffect<T>(
  source: () => Observable<T>,
  options: Option,
  deps: DependencyList
): void

export function useSubscribeEffect<T>(
  source: Observable<T> | (() => Observable<T>),
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
