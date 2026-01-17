export interface UseObserveResult<Value, DefaultValue, Error = unknown> {
    data: Value | DefaultValue
    error: Error | undefined
    /**
     * - pending: if there's no cached data and no query attempt was finished yet.
     * - success: if the query has received a response with no errors and is ready to display its data
     * - error: if the query attempt resulted in an error. The corresponding error property has the error received from the attempted fetch
     */
    status: "pending" | "success" | "error"
    observableState: "complete" | "live"
  }