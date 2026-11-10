/**
 * The retry options, read the way TanStack Query reads a mutation's, in
 * checks it does not export. `attempt` counts the retries already made: 0
 * before the first one.
 */

/**
 * Whether to retry: a function decides, a number caps the retries, `true`
 * never stops, and no value never retries.
 */
export const shouldRetry = <TError>(
  retry:
    | boolean
    | number
    | ((attempt: number, error: TError) => boolean)
    | undefined,
  attempt: number,
  error: TError,
) => {
  if (typeof retry === "function") return retry(attempt, error)

  if (typeof retry === "number") return attempt < retry

  return retry === true
}

/**
 * 1 s, doubled at each retry, up to 30 s.
 */
const defaultRetryDelay = (attempt: number) =>
  Math.min(1000 * 2 ** attempt, 30_000)

/**
 * The time to wait before a retry, in milliseconds: a number, or a function
 * of the attempt and the error, `defaultRetryDelay` when there is none.
 */
export const getRetryDelay = <TError>(
  retryDelay: number | ((attempt: number, error: TError) => number) | undefined,
  attempt: number,
  error: TError,
) => {
  const delay = retryDelay ?? defaultRetryDelay

  return typeof delay === "function" ? delay(attempt, error) : delay
}
