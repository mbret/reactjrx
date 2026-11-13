import {
  type DependencyList,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { BehaviorSubject, type Observable } from "rxjs"
import { useLiveRef } from "../../utils/react/useLiveRef"
import type { UseObserveOptions, UseObserveResult } from "./types"

export type {
  ObservableState,
  UseObserveOptions,
  UseObserveResult,
} from "./types"

type OptionsWithDefaultValue<T, DefaultValue> = UseObserveOptions<
  T,
  DefaultValue
> & { defaultValue: DefaultValue }

type OptionsWithoutDefaultValue<T> = Omit<
  UseObserveOptions<T, never>,
  "defaultValue"
>

/** Whether the source has a value, and how its stream ended. */
type SourceState<T> = (
  | { observableState: "live" | "complete" }
  | { observableState: "error"; error: unknown }
) &
  ({ hasValue: false } | { hasValue: true; value: T })

/**
 * One observation of a source, created when the deps change. It is kept in
 * state, so React keeps it across renders, and across the effects it runs
 * again (`StrictMode` in development, an `<Activity>` shown again). A deps
 * change starts a new one, even when the factory returns the same
 * observable.
 */
type Observation<T> = {
  deps: DependencyList
  source: Observable<T> | undefined
  /** What render shows of the source before the effect subscribes. */
  initialState: SourceState<T>
}

const observe = <T>(
  source$: Observable<T> | undefined | (() => Observable<T> | undefined),
  deps: DependencyList,
): Observation<T> => {
  const source = typeof source$ === "function" ? source$() : source$

  return { deps, source, initialState: getInitialState(source) }
}

const areDepsEqual = (a: DependencyList, b: DependencyList) =>
  a.length === b.length && a.every((dep, index) => Object.is(dep, b[index]))

/**
 * Only the value a `BehaviorSubject` holds (a signal is one) is read
 * without a subscription.
 */
const getInitialState = <T>(
  source: Observable<T> | undefined,
): SourceState<T> => {
  if (source === undefined) {
    return { observableState: "complete", hasValue: false }
  }

  if (source instanceof BehaviorSubject) {
    try {
      return {
        observableState: "live",
        hasValue: true,
        value: source.getValue(),
      }
    } catch (error) {
      // An errored subject throws its error, a closed one `ObjectUnsubscribedError`.
      return { observableState: "error", error, hasValue: false }
    }
  }

  return { observableState: "live", hasValue: false }
}

const isStrictlyEqual = (a: unknown, b: unknown) => a === b

const toResult = <T, DefaultValue>(
  state: SourceState<T>,
  defaultValue: DefaultValue,
): UseObserveResult<T, DefaultValue> => {
  if (state.observableState === "error") {
    return {
      status: "error",
      data: state.hasValue ? state.value : defaultValue,
      error: state.error,
      observableState: "error",
    }
  }

  if (state.hasValue) {
    return {
      status: "success",
      data: state.value,
      error: undefined,
      observableState: state.observableState,
    }
  }

  return {
    status: "pending",
    data: defaultValue,
    error: undefined,
    observableState: state.observableState,
  }
}

/**
 * The source can be `undefined` (directly or returned from a factory). This is
 * useful when the observable is not available yet (lazily created, coming from
 * a state, a prop, etc). In that case the hook returns the default value with a
 * `complete` observable state and will start observing as soon as an actual
 * source is given.
 */
export function useObserve(
  source: undefined,
): UseObserveResult<never, undefined>

export function useObserve<DefaultValue>(
  source: undefined,
  options: OptionsWithDefaultValue<unknown, DefaultValue>,
): UseObserveResult<never, DefaultValue>

/**
 * A `BehaviorSubject` always holds a value, so `data` is typed as one. A
 * subject that already errored, or is closed, has none: `status` is
 * `"error"` and `data` is `undefined`.
 */
export function useObserve<T>(
  source: BehaviorSubject<T>,
): UseObserveResult<T, T>

export function useObserve<T>(
  source: BehaviorSubject<T>,
  options: OptionsWithoutDefaultValue<T>,
): UseObserveResult<T, T>

export function useObserve<T>(
  source: Observable<T> | undefined,
): UseObserveResult<T, undefined>

export function useObserve<T>(
  source: () => Observable<T>,
  deps: DependencyList,
): UseObserveResult<T, undefined>

export function useObserve<T>(
  source: () => Observable<T> | undefined,
  deps: DependencyList,
): UseObserveResult<T, undefined>

export function useObserve<T, DefaultValue>(
  source: Observable<T> | undefined,
  options: OptionsWithDefaultValue<T, DefaultValue>,
): UseObserveResult<T, DefaultValue>

export function useObserve<T>(
  source: Observable<T> | undefined,
  options: OptionsWithoutDefaultValue<T>,
): UseObserveResult<T, undefined>

export function useObserve<T, DefaultValue>(
  source: () => Observable<T>,
  options: OptionsWithDefaultValue<T, DefaultValue>,
  deps: DependencyList,
): UseObserveResult<T, DefaultValue>

export function useObserve<T, DefaultValue>(
  source: () => Observable<T> | undefined,
  options: OptionsWithDefaultValue<T, DefaultValue>,
  deps: DependencyList,
): UseObserveResult<T, DefaultValue>

export function useObserve<T, DefaultValue = T>(
  source$: Observable<T> | undefined | (() => Observable<T> | undefined),
  optionsOrDeps?: UseObserveOptions<T, DefaultValue> | DependencyList,
  maybeDeps?: DependencyList,
): UseObserveResult<T, DefaultValue | undefined> {
  const options: UseObserveOptions<T, DefaultValue> =
    optionsOrDeps != null && !Array.isArray(optionsOrDeps)
      ? // `Array.isArray` does not narrow out a readonly `DependencyList`.
        (optionsOrDeps as UseObserveOptions<T, DefaultValue>)
      : {}
  const deps =
    !maybeDeps && Array.isArray(optionsOrDeps)
      ? optionsOrDeps
      : typeof source$ === "function"
        ? (maybeDeps ?? [])
        : [source$]

  const [state, setState] = useState(() => {
    const observation = observe(source$, deps)

    return { observation, sourceState: observation.initialState }
  })
  let { observation, sourceState } = state

  /**
   * New deps start a new observation during render, and React renders again
   * at once. A source created on every render, such as `source$.pipe(...)`
   * written in the component, therefore makes React throw "Too many
   * re-renders" rather than subscribe again without end.
   */
  if (!areDepsEqual(observation.deps, deps)) {
    observation = observe(source$, deps)
    sourceState = observation.initialState
    setState({ observation, sourceState })
  }
  const compareFnRef = useLiveRef(options.compareFn)
  /**
   * The latest state of an observation, as its subscription set it. An effect
   * that React runs again for the same observation starts from it, and does
   * not subscribe again to a source that already completed or errored: a cold
   * source would start over.
   */
  const latestRef = useRef<
    { observation: Observation<T>; sourceState: SourceState<T> } | undefined
  >(undefined)

  /**
   * The source is subscribed after commit only, so a render that React throws
   * away, and a server render, start nothing.
   */
  useEffect(
    function observeSource() {
      const { source } = observation
      let latest =
        latestRef.current?.observation === observation
          ? latestRef.current.sourceState
          : observation.initialState

      if (!source || latest.observableState !== "live") return

      /**
       * Only this subscription changes the state of its observation, so a
       * value that changes nothing, such as the one a `BehaviorSubject`
       * emits on subscription, sets no state and renders nothing.
       */
      const commit = (next: SourceState<T>) => {
        latest = next
        latestRef.current = { observation, sourceState: next }
        setState({ observation, sourceState: next })
      }

      const subscription = source.subscribe({
        next: (value) => {
          const isEqual = compareFnRef.current ?? isStrictlyEqual

          if (latest.hasValue && isEqual(latest.value, value)) return

          commit({ observableState: "live", hasValue: true, value })
        },
        error: (error: unknown) => {
          commit(
            latest.hasValue
              ? {
                  observableState: "error",
                  error,
                  hasValue: true,
                  value: latest.value,
                }
              : { observableState: "error", error, hasValue: false },
          )
        },
        complete: () => {
          commit(
            latest.hasValue
              ? {
                  observableState: "complete",
                  hasValue: true,
                  value: latest.value,
                }
              : { observableState: "complete", hasValue: false },
          )
        },
      })

      return () => {
        subscription.unsubscribe()
      }
    },
    [observation, compareFnRef],
  )

  const shownDefaultValue = sourceState.hasValue
    ? undefined
    : options.defaultValue

  return useMemo(
    () => toResult(sourceState, shownDefaultValue),
    [sourceState, shownDefaultValue],
  )
}
