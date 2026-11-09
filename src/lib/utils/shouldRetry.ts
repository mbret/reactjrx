/**
 * Whether to retry after `attempt` retries (0 before the first one): a
 * function decides, a number caps the retries, `true` never stops, and no
 * value never retries. TanStack Query reads a mutation's `retry` the same
 * way, in a check it does not export.
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
