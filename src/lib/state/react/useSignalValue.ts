import { useCallback, useRef, useSyncExternalStore } from "react"
import { skip } from "rxjs"
import type { Signal, VirtualSignal } from "../Signal"
import { useSignalReference } from "./useSignalReference"

export type EqualityFn<T> = (a: T, b: T) => boolean

const defaultEqualityFn: EqualityFn<unknown> = Object.is

/**
 * Subscribe to a signal's current value, with optional projection and equality.
 *
 * - On every render the returned value is `selector(signal.value)` (or
 *   `signal.value` when no selector is provided), recomputed only when the
 *   signal value, the selector identity, or the signal itself has changed.
 * - The component re-renders whenever the signal emits a value that the
 *   `equalityFn` considers different from the previous one.
 * - The hook caches its last result. When the new selector output is
 *   considered equal to the previous one (per `equalityFn`), the previous
 *   reference is returned, so downstream `useEffect`/`useMemo` dependencies
 *   stay stable.
 *
 * @param signal The signal (or `VirtualSignal` resolved through context) to read.
 * @param selector Optional projection of the signal value.
 * @param equalityFn Optional equality function. Defaults to `Object.is`.
 *   Pass `isShallowEqual` (or any custom comparator) to opt into reference
 *   stability for derived objects.
 */
export function useSignalValue<T>(signal: VirtualSignal<T>): T

export function useSignalValue<T, SelectValue>(
  signal: VirtualSignal<T>,
  selector: (value: T) => SelectValue,
  equalityFn?: EqualityFn<SelectValue>,
): SelectValue

export function useSignalValue<T>(signal: Signal<T>): T

export function useSignalValue<T, SelectValue>(
  signal: Signal<T>,
  selector: (value: T) => SelectValue,
  equalityFn?: EqualityFn<SelectValue>,
): SelectValue

export function useSignalValue(
  signal: Signal<unknown> | VirtualSignal<unknown>,
  selector?: (value: unknown) => unknown,
  equalityFn: EqualityFn<unknown> = defaultEqualityFn,
) {
  const finalSignal = useSignalReference(signal)
  const cacheRef = useRef<{
    hasValue: boolean
    signal: Signal<unknown> | undefined
    selector: ((value: unknown) => unknown) | undefined
    sourceValue: unknown
    value: unknown
  }>({
    hasValue: false,
    signal: undefined,
    selector: undefined,
    sourceValue: undefined,
    value: undefined,
  })

  const subscribe = useCallback(
    (onChange: () => void) => {
      /**
       * `Signal` is a `BehaviorSubject` and synchronously emits its current
       * value to new subscribers. `useSyncExternalStore`'s subscribe contract,
       * however, expects `onChange` to fire only on *changes* — the initial
       * value is read separately via `getSnapshot`. Skipping the first
       * emission keeps the contract clean and avoids a redundant
       * post-subscribe snapshot read by React.
       */
      const sub = finalSignal.pipe(skip(1)).subscribe(() => {
        onChange()
      })

      return () => {
        sub.unsubscribe()
      }
    },
    [finalSignal],
  )

  const getSnapshot = () => {
    const cached = cacheRef.current
    const sourceValue = finalSignal.value

    /**
     * Fast path: nothing relevant changed since last call, so we can skip
     * running the selector entirely and return the previously computed value.
     */
    if (
      cached.hasValue &&
      cached.signal === finalSignal &&
      cached.selector === selector &&
      cached.sourceValue === sourceValue
    ) {
      return cached.value
    }

    const next = selector ? selector(sourceValue) : sourceValue

    /**
     * Reference-stability path: selector ran (because something changed) but
     * its output is considered equal (per `equalityFn`) to the previous one,
     * so we keep the previous reference to avoid spurious re-renders
     * downstream. With the default `Object.is` this rarely kicks in; when the
     * caller opts into a structural comparator (e.g. `isShallowEqual`) this
     * provides referential stability for derived objects.
     */
    if (
      cached.hasValue &&
      cached.signal === finalSignal &&
      equalityFn(cached.value, next)
    ) {
      cacheRef.current = {
        hasValue: true,
        signal: finalSignal,
        selector,
        sourceValue,
        value: cached.value,
      }

      return cached.value
    }

    cacheRef.current = {
      hasValue: true,
      signal: finalSignal,
      selector,
      sourceValue,
      value: next,
    }

    return next
  }

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
