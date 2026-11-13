export interface UseObserveOptions<T, DefaultValue> {
  /**
   * Returned as `data` while the source has no value: before its first
   * value, and when it completes or errors without one. Keep it stable: a new
   * object on every render is a new `data` on every render.
   */
  defaultValue?: DefaultValue
  /**
   * Tells whether a new value equals the previous one. An equal value does
   * not re-render. Defaults to strict equality (`===`).
   */
  compareFn?: (a: T, b: T) => boolean
}

/**
 * The life of the stream, apart from its value: `"live"` while it can
 * still emit, `"complete"` once it completed (or when there is no source),
 * `"error"` once it errored.
 */
export type ObservableState = "live" | "complete" | "error"

/**
 * The state of the source, by whether it has a value, as the queries of
 * TanStack Query report theirs. `data` is typed by `status`.
 */
export type UseObserveResult<Value, DefaultValue, Error = unknown> =
  | {
      /**
       * The source has no value: none yet, it completed without one, or
       * there is no source.
       */
      status: "pending"
      data: DefaultValue
      error: undefined
      observableState: Exclude<ObservableState, "error">
    }
  | {
      /** The source has a value. */
      status: "success"
      data: Value
      error: undefined
      observableState: Exclude<ObservableState, "error">
    }
  | {
      /** The source errored. `data` keeps its last value, if it had one. */
      status: "error"
      data: Value | DefaultValue
      error: Error
      observableState: "error"
    }
