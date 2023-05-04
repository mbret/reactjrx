import { type DependencyList, useCallback } from 'react'
import { type Observable, catchError, identity, retry } from 'rxjs'
import { useSubscribe } from '../binding/useSubscribe'

interface Option {
  retry?: boolean
}

export function useSubscribeEffect<T> (source: Observable<T>): void
export function useSubscribeEffect<T> (
  source: Observable<T>,
  options: Option
): void

export function useSubscribeEffect<T> (
  source: () => Observable<T>,
  deps: DependencyList
): void

export function useSubscribeEffect<T> (
  source: () => Observable<T>,
  options: Option,
  deps: DependencyList
): void

export function useSubscribeEffect<T> (
  source: Observable<T> | (() => Observable<T>),
  unsafeOptions?: Option | DependencyList,
  deps: DependencyList = []
) {
  const options =
    unsafeOptions != null && !Array.isArray(unsafeOptions)
      ? (unsafeOptions as Option)
      : ({} satisfies Option)
  const retryOption = options.retry ?? true
  const isSourceFn = typeof source === 'function'
  const makeObservable = useCallback(
    isSourceFn ? source : () => source,
    isSourceFn ? deps : [source]
  )
  const enhancerMakeObservable = useCallback(
    () =>
      makeObservable().pipe(
        catchError((error) => {
          console.error(error)

          throw error
        }),
        retryOption ? retry() : identity
      ),
    [makeObservable]
  )

  useSubscribe(enhancerMakeObservable, deps)
}
